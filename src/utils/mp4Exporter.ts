import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { ExportProgress, Mp4ValidationResult, QuizConfig } from '../types/quiz';
import { synthesizeQuizAudioBuffer } from './audioSynth';
import { renderQuizFrame } from './canvasRenderer';
import { parseAndValidateMp4 } from './mp4Parser';

export interface ExportOptions {
  quiz: QuizConfig;
  onProgress?: (progress: ExportProgress) => void;
  preferredEngine?: 'auto' | 'webcodecs' | 'wasm';
}

export interface ExportResult {
  blob: Blob;
  buffer: Uint8Array;
  validation: Mp4ValidationResult;
  engineUsed: string;
  durationSeconds: number;
  width: number;
  height: number;
}

/**
 * Checks if browser WebCodecs VideoEncoder is available and supports H.264 (AVC).
 */
export async function checkWebCodecsSupport(width: number, height: number): Promise<boolean> {
  if (typeof window === 'undefined' || typeof (window as any).VideoEncoder !== 'function') {
    return false;
  }
  try {
    const res = await (window as any).VideoEncoder.isConfigSupported({
      codec: 'avc1.42001f', // Baseline profile level 3.1
      width,
      height,
      bitrate: 2_500_000,
      framerate: 30,
    });
    return !!res?.supported;
  } catch (e) {
    console.warn('WebCodecs H.264 support check failed:', e);
    return false;
  }
}

/**
 * Main export function: traces complete workflow from rendering through encoding,
 * audio mixing, finalization, and validation.
 */
export async function exportQuizToMp4(options: ExportOptions): Promise<ExportResult> {
  const { quiz, onProgress, preferredEngine = 'auto' } = options;

  // 1. Calculate dimensions (Must be even for H.264)
  const isPortrait = quiz.aspectRatio === '9:16';
  const width = isPortrait ? 720 : 1280;
  const height = isPortrait ? 1280 : 720;
  const fps = quiz.fps || 30;

  // Total duration calculation
  const totalDuration =
    quiz.questions.length * (quiz.countdownDuration + quiz.revealDuration) + quiz.finalScreenDuration;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  onProgress?.({
    stage: 'audio',
    currentFrame: 0,
    totalFrames,
    percent: 0,
    message: 'Synthesizing offline audio timeline...',
  });

  // 2. Synthesize audio buffer offline
  let audioBuffer: AudioBuffer | null = null;
  if (quiz.enableBgm || quiz.enableSfx) {
    try {
      audioBuffer = await synthesizeQuizAudioBuffer(quiz, totalDuration, 44100);
    } catch (e) {
      console.warn('Audio synthesis failed, proceeding with video-only:', e);
    }
  }

  // Determine which engine to use
  const hasWebCodecs = await checkWebCodecsSupport(width, height);
  const useWebCodecs = preferredEngine === 'webcodecs' || (preferredEngine === 'auto' && hasWebCodecs);

  let mp4Bytes: Uint8Array;
  let engineUsed = '';

  if (useWebCodecs && typeof (window as any).VideoEncoder !== 'undefined') {
    engineUsed = 'WebCodecs (Hardware H.264/AAC) + mp4-muxer';
    mp4Bytes = await exportWithWebCodecs({
      quiz,
      width,
      height,
      fps,
      totalDuration,
      totalFrames,
      audioBuffer,
      onProgress,
    });
  } else {
    engineUsed = 'Self-Contained Embedded WASM (OpenH264)';
    mp4Bytes = await exportWithWasm({
      quiz,
      width,
      height,
      fps,
      totalDuration,
      totalFrames,
      onProgress,
    });
  }

  // 3. Finalize & Validate MP4
  onProgress?.({
    stage: 'verifying',
    currentFrame: totalFrames,
    totalFrames,
    percent: 98,
    message: 'Validating ISO BMFF boxes (ftyp, moov, mdat)...',
  });

  const validation = parseAndValidateMp4(mp4Bytes);

  if (!validation.isValidMp4) {
    throw new Error(
      `MP4 validation failed: ${validation.diagnostics.join('; ')}`
    );
  }

  // 4. Create real video/mp4 Blob
  const blob = new Blob([mp4Bytes.buffer as ArrayBuffer], { type: 'video/mp4' });

  onProgress?.({
    stage: 'done',
    currentFrame: totalFrames,
    totalFrames,
    percent: 100,
    message: `Export completed! Genuine MP4 (${(blob.size / 1024 / 1024).toFixed(2)} MB)`,
  });

  return {
    blob,
    buffer: mp4Bytes,
    validation,
    engineUsed,
    durationSeconds: totalDuration,
    width,
    height,
  };
}

/**
 * Engine 1: WebCodecs + mp4-muxer
 */
async function exportWithWebCodecs(params: {
  quiz: QuizConfig;
  width: number;
  height: number;
  fps: number;
  totalDuration: number;
  totalFrames: number;
  audioBuffer: AudioBuffer | null;
  onProgress?: (progress: ExportProgress) => void;
}): Promise<Uint8Array> {
  const { quiz, width, height, fps, totalDuration, totalFrames, audioBuffer, onProgress } = params;

  // Offscreen canvas for rendering frames
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error('Failed to get 2D canvas context');

  // Configure Muxer
  const muxerTarget = new ArrayBufferTarget();

  let canEncodeAudio = false;
  if (audioBuffer && typeof (window as any).AudioEncoder !== 'undefined') {
    try {
      const audioSupport = await (window as any).AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        numberOfChannels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        bitrate: 128_000,
      });
      canEncodeAudio = !!audioSupport?.supported;
    } catch {
      canEncodeAudio = false;
    }
  }

  const muxer = new Muxer({
    target: muxerTarget,
    video: {
      codec: 'avc',
      width,
      height,
      frameRate: fps,
    },
    audio: canEncodeAudio && audioBuffer
      ? {
          codec: 'aac',
          numberOfChannels: audioBuffer.numberOfChannels,
          sampleRate: audioBuffer.sampleRate,
        }
      : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'strict',
  });

  // Setup VideoEncoder
  let videoEncoderError: Error | null = null;
  const videoEncoder = new (window as any).VideoEncoder({
    output: (chunk: any, meta: any) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e: any) => {
      console.error('VideoEncoder error:', e);
      videoEncoderError = e;
    },
  });

  videoEncoder.configure({
    codec: 'avc1.42001f', // Baseline profile level 3.1
    width,
    height,
    bitrate: 2_800_000,
    framerate: fps,
  });

  // Setup AudioEncoder if available
  let audioEncoder: any = null;
  if (canEncodeAudio && audioBuffer) {
    audioEncoder = new (window as any).AudioEncoder({
      output: (chunk: any, meta: any) => {
        muxer.addAudioChunk(chunk, meta);
      },
      error: (e: any) => {
        console.warn('AudioEncoder error:', e);
      },
    });

    audioEncoder.configure({
      codec: 'mp4a.40.2',
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate,
      bitrate: 128_000,
    });

    // Feed audio buffer data in chunks (typically 1024 or 2048 samples)
    const chunkSize = 1024;
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = audioBuffer.length;

    // Planar float32 data
    const channelData: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channelData.push(audioBuffer.getChannelData(c));
    }

    let sampleOffset = 0;
    while (sampleOffset < totalSamples) {
      const framesToEncode = Math.min(chunkSize, totalSamples - sampleOffset);
      const audioTimestampMicros = Math.round((sampleOffset / sampleRate) * 1_000_000);

      const chunkBuffer = new Float32Array(framesToEncode * numChannels);
      for (let c = 0; c < numChannels; c++) {
        const chan = channelData[c];
        for (let s = 0; s < framesToEncode; s++) {
          chunkBuffer[c * framesToEncode + s] = chan[sampleOffset + s];
        }
      }

      const audioData = new (window as any).AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: framesToEncode,
        numberOfChannels: numChannels,
        timestamp: audioTimestampMicros,
        data: chunkBuffer,
      });

      audioEncoder.encode(audioData);
      audioData.close();
      sampleOffset += framesToEncode;
    }
  }

  // Frame rendering and encoding loop
  const frameIntervalMicros = Math.round(1_000_000 / fps);
  let lastReportTime = Date.now();
  let framesSinceLastReport = 0;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (videoEncoderError) {
      throw videoEncoderError;
    }

    const currentTime = frameIndex / fps;
    renderQuizFrame(ctx as any, quiz, currentTime, width, height);

    const frameTimestamp = frameIndex * frameIntervalMicros;
    const isKeyframe = frameIndex % (fps * 2) === 0;

    const videoFrame = new (window as any).VideoFrame(canvas, {
      timestamp: frameTimestamp,
      duration: frameIntervalMicros,
    });

    videoEncoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close();

    framesSinceLastReport++;
    const now = Date.now();
    if (now - lastReportTime >= 100 || frameIndex === totalFrames - 1) {
      const currentFps = Math.round((framesSinceLastReport / (now - lastReportTime)) * 1000);
      const percent = Math.min(95, Math.round(((frameIndex + 1) / totalFrames) * 95));
      onProgress?.({
        stage: 'encoding',
        currentFrame: frameIndex + 1,
        totalFrames,
        percent,
        currentFps: isFinite(currentFps) ? currentFps : 30,
        message: `Rendering & encoding frame ${frameIndex + 1}/${totalFrames} (${percent}%)...`,
      });
      lastReportTime = now;
      framesSinceLastReport = 0;
      // Yield to event loop to keep UI smooth
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Flush encoders
  onProgress?.({
    stage: 'finalizing',
    currentFrame: totalFrames,
    totalFrames,
    percent: 96,
    message: 'Flushing video and audio streams into MP4 muxer...',
  });

  await videoEncoder.flush();
  videoEncoder.close();

  if (audioEncoder) {
    await audioEncoder.flush();
    audioEncoder.close();
  }

  // Finalize MP4 muxer
  muxer.finalize();
  return new Uint8Array(muxerTarget.buffer);
}

/**
 * Engine 2: 100% Offline Embedded WASM H.264 Encoder (h264-mp4-encoder)
 * Works in any browser without WebCodecs and in Node.js test environments.
 */
async function exportWithWasm(params: {
  quiz: QuizConfig;
  width: number;
  height: number;
  fps: number;
  totalDuration: number;
  totalFrames: number;
  onProgress?: (progress: ExportProgress) => void;
}): Promise<Uint8Array> {
  const { quiz, width, height, fps, totalFrames, onProgress } = params;

  // Import h264-mp4-encoder dynamically
  const HME = await import('h264-mp4-encoder');
  const encoder = await (HME.default ? HME.default.createH264MP4Encoder() : (HME as any).createH264MP4Encoder());

  encoder.width = width;
  encoder.height = height;
  encoder.frameRate = fps;
  encoder.kbps = 2500;
  encoder.speed = 10; // Fast encoding
  encoder.groupOfPictures = fps * 2;
  encoder.outputFilename = `quiz_${Date.now()}.mp4`;
  encoder.initialize();

  // Create canvas for rendering frames
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to create canvas 2D context for offline export');

  let lastReportTime = Date.now();
  let framesSinceLastReport = 0;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const currentTime = frameIndex / fps;
    renderQuizFrame(ctx, quiz, currentTime, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    encoder.addFrameRgba(imgData.data);

    framesSinceLastReport++;
    const now = Date.now();
    if (now - lastReportTime >= 100 || frameIndex === totalFrames - 1) {
      const currentFps = Math.round((framesSinceLastReport / (now - lastReportTime)) * 1000);
      const percent = Math.min(95, Math.round(((frameIndex + 1) / totalFrames) * 95));
      onProgress?.({
        stage: 'encoding',
        currentFrame: frameIndex + 1,
        totalFrames,
        percent,
        currentFps: isFinite(currentFps) ? currentFps : 30,
        message: `Rendering & encoding frame ${frameIndex + 1}/${totalFrames} (${percent}%)...`,
      });
      lastReportTime = now;
      framesSinceLastReport = 0;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress?.({
    stage: 'finalizing',
    currentFrame: totalFrames,
    totalFrames,
    percent: 96,
    message: 'Finalizing MP4 file in memory...',
  });

  encoder.finalize();
  const fileBytes = encoder.FS.readFile(encoder.outputFilename);
  encoder.delete();

  return new Uint8Array(fileBytes);
}

/**
 * Triggers genuine MP4 file download in browser
 */
export function downloadMp4Blob(blob: Blob, filename?: string) {
  if (typeof window === 'undefined') return;
  const name = filename || `quiz_video_${Date.now()}.mp4`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
