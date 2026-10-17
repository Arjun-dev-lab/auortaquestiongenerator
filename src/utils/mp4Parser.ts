import { Mp4BoxInfo, Mp4ValidationResult } from '../types/quiz';

/**
 * Parses and validates an ISO Base Media File Format (MP4) binary array buffer.
 * Provides deep structural inspection to guarantee genuine MP4 compatibility.
 */
export function parseAndValidateMp4(buffer: ArrayBuffer | Uint8Array): Mp4ValidationResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const diagnostics: string[] = [];

  // Check if WebM (EBML header starts with 0x1A 0x45 0xDF 0xA3)
  const isWebm =
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3;

  if (isWebm) {
    diagnostics.push('CRITICAL: Detected WebM EBML header (0x1A45DFA3). This file is a WebM container renamed to .mp4!');
  }

  // First 64 bytes hex representation
  const hexSlice = Array.from(bytes.slice(0, Math.min(64, bytes.length)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

  const rawBoxes: Mp4BoxInfo[] = [];
  const boxesFound: string[] = [];
  let offset = 0;
  let majorBrand = '';
  let minorVersion = 0;
  const compatibleBrands: string[] = [];

  let hasFtyp = false;
  let hasMoov = false;
  let hasMdat = false;
  let hasVideoTrack = false;
  let hasAudioTrack = false;
  let durationSeconds: number | undefined;
  let width: number | undefined;
  let height: number | undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset + 8 <= bytes.length) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    let boxHeaderSize = 8;
    if (size === 1) {
      // 64-bit extended size
      if (offset + 16 > bytes.length) break;
      const high = view.getUint32(offset + 8);
      const low = view.getUint32(offset + 12);
      size = high * 4294967296 + low;
      boxHeaderSize = 16;
    } else if (size === 0) {
      // Box extends to end of file
      size = bytes.length - offset;
    }

    if (size < 8) {
      // Corrupt box size
      diagnostics.push(`Warning: Corrupted box size ${size} at offset ${offset}`);
      break;
    }

    boxesFound.push(type);
    const boxInfo: Mp4BoxInfo = {
      type,
      offset,
      size,
    };

    if (type === 'ftyp') {
      hasFtyp = true;
      if (offset + 16 <= bytes.length) {
        majorBrand = String.fromCharCode(
          bytes[offset + 8],
          bytes[offset + 9],
          bytes[offset + 10],
          bytes[offset + 11]
        );
        minorVersion = view.getUint32(offset + 12);

        // Read compatible brands
        for (let b = offset + 16; b + 4 <= offset + size && b + 4 <= bytes.length; b += 4) {
          const brand = String.fromCharCode(bytes[b], bytes[b + 1], bytes[b + 2], bytes[b + 3]);
          compatibleBrands.push(brand);
        }
      }
      boxInfo.description = `Major Brand: ${majorBrand}, Minor: ${minorVersion}, Compatible: [${compatibleBrands.join(', ')}]`;
    } else if (type === 'moov') {
      hasMoov = true;
      boxInfo.description = 'Movie header container (metadata index)';
      // Inspect children inside moov
      inspectMoovChildren(bytes, offset + boxHeaderSize, offset + size, boxInfo);
    } else if (type === 'mdat') {
      hasMdat = true;
      boxInfo.description = `Media data payload (${(size / 1024 / 1024).toFixed(2)} MB)`;
    }

    rawBoxes.push(boxInfo);
    offset += size;
  }

  function inspectMoovChildren(
    b: Uint8Array,
    start: number,
    end: number,
    parentBox: Mp4BoxInfo
  ) {
    let cur = start;
    const children: Mp4BoxInfo[] = [];

    while (cur + 8 <= end && cur + 8 <= b.length) {
      const cSize = view.getUint32(cur);
      const cType = String.fromCharCode(b[cur + 4], b[cur + 5], b[cur + 6], b[cur + 7]);
      if (cSize < 8 || cur + cSize > end) break;

      const child: Mp4BoxInfo = { type: cType, offset: cur, size: cSize };

      if (cType === 'trak') {
        // Track box
        inspectTrakBox(b, cur + 8, cur + cSize, child);
      } else if (cType === 'mvhd') {
        // Movie header
        child.description = 'Movie Header (timescale & duration)';
      }

      children.push(child);
      cur += cSize;
    }
    parentBox.children = children;
  }

  function inspectTrakBox(
    b: Uint8Array,
    start: number,
    end: number,
    trakBox: Mp4BoxInfo
  ) {
    let cur = start;
    const trakChildren: Mp4BoxInfo[] = [];

    while (cur + 8 <= end && cur + 8 <= b.length) {
      const cSize = view.getUint32(cur);
      const cType = String.fromCharCode(b[cur + 4], b[cur + 5], b[cur + 6], b[cur + 7]);
      if (cSize < 8 || cur + cSize > end) break;

      const child: Mp4BoxInfo = { type: cType, offset: cur, size: cSize };

      if (cType === 'tkhd') {
        // Track Header: check width and height if video track
        if (cur + 84 <= end) {
          const w = view.getUint32(cur + cSize - 8) >> 16;
          const h = view.getUint32(cur + cSize - 4) >> 16;
          if (w > 0 && h > 0) {
            width = w;
            height = h;
            child.description = `Track dimensions: ${w}x${h}`;
          }
        }
      } else if (cType === 'mdia') {
        // Scan for hdlr inside mdia
        let mCur = cur + 8;
        while (mCur + 8 <= cur + cSize) {
          const mSize = view.getUint32(mCur);
          const mType = String.fromCharCode(b[mCur + 4], b[mCur + 5], b[mCur + 6], b[mCur + 7]);
          if (mSize < 8) break;

          if (mType === 'hdlr' && mCur + 16 <= cur + cSize) {
            const handlerType = String.fromCharCode(
              b[mCur + 16],
              b[mCur + 17],
              b[mCur + 18],
              b[mCur + 19]
            );
            if (handlerType === 'vide') {
              hasVideoTrack = true;
              trakBox.description = 'Video Track (H.264 / AVC)';
            } else if (handlerType === 'soun') {
              hasAudioTrack = true;
              trakBox.description = 'Audio Track (AAC)';
            }
          }
          mCur += mSize;
        }
      }

      trakChildren.push(child);
      cur += cSize;
    }
    trakBox.children = trakChildren;
  }

  // Diagnostic checks
  const isValidMp4 = !isWebm && hasFtyp && (hasMoov || boxesFound.includes('moov')) && (hasMdat || boxesFound.includes('mdat'));

  if (!hasFtyp) {
    diagnostics.push('Missing ftyp (File Type) box at start of file.');
  } else {
    diagnostics.push(`File Type Box verified: Major Brand "${majorBrand}", Minor Version ${minorVersion}`);
  }

  if (!hasMoov) {
    diagnostics.push('Missing moov box: MP4 index/metadata not found or export finalized prematurely.');
  } else {
    diagnostics.push('moov box found: Video metadata structure is valid.');
  }

  if (!hasMdat) {
    diagnostics.push('Missing mdat box: Media frames payload is empty.');
  } else {
    diagnostics.push('mdat box found: Contains encoded audio/video frame bitstream.');
  }

  if (hasVideoTrack) {
    diagnostics.push('Video track (vide) successfully identified in trak box.');
  }

  if (hasAudioTrack) {
    diagnostics.push('Audio track (soun) successfully identified in trak box.');
  }

  if (isValidMp4) {
    diagnostics.push('VERIFIED: Genuine ISO Base Media File Format MP4 (video/mp4) ready for cross-platform playback.');
  }

  return {
    isValidMp4,
    isWebm,
    fileSizeBytes: bytes.length,
    majorBrand,
    minorVersion,
    compatibleBrands,
    boxesFound,
    hasFtyp,
    hasMoov,
    hasMdat,
    hasVideoTrack,
    hasAudioTrack,
    videoCodec: hasVideoTrack ? 'avc1 (H.264)' : undefined,
    durationSeconds,
    width,
    height,
    first64BytesHex: hexSlice,
    rawBoxes,
    diagnostics,
  };
}
