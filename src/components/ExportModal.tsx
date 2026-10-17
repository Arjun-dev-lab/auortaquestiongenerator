import React, { useState } from 'react';
import { ExportProgress } from '../types/quiz';
import { ExportResult, downloadMp4Blob } from '../utils/mp4Exporter';
import { Mp4DiagnosticsModal } from './Mp4DiagnosticsModal';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
  Cpu,
  Film,
  Music,
  X,
  RefreshCw,
} from 'lucide-react';

interface Props {
  progress: ExportProgress;
  result: ExportResult | null;
  isExporting: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export const ExportModal: React.FC<Props> = ({
  progress,
  result,
  isExporting,
  onClose,
  onRetry,
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const isDone = progress.stage === 'done' && result !== null;
  const isError = progress.stage === 'error';

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 relative">
          {/* Close button if not currently encoding */}
          {!isExporting && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-3 rounded-xl border ${
              isDone
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : isError
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            }`}>
              {isDone ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isError ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <Film className="w-6 h-6 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                {isDone ? 'MP4 Export Completed!' : isError ? 'Export Error' : 'Generating Offline MP4'}
              </h3>
              <p className="text-xs text-slate-400">
                {isDone
                  ? 'Genuine ISO Base Media File Format video ready'
                  : isError
                  ? 'An error occurred during encoding'
                  : 'Zero external CDN requests • 100% offline generation'}
              </p>
            </div>
          </div>

          {/* Body */}
          {isExporting && (
            <div className="space-y-5">
              {/* Progress message & percentage */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-200">{progress.message}</span>
                <span className="font-mono font-bold text-indigo-400 text-base">{progress.percent}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-150"
                  style={{ width: `${Math.max(3, progress.percent)}%` }}
                />
              </div>

              {/* Frame stats */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400 block mb-1">Rendered Frames</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {progress.currentFrame} / {progress.totalFrames}
                  </span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400 block mb-1">Encoding Speed</span>
                  <span className="font-mono font-bold text-sky-400 text-sm">
                    {progress.currentFps ? `${progress.currentFps} FPS` : 'Computing...'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Deterministic offline frame-by-frame rendering with audio mix
              </div>
            </div>
          )}

          {/* Success state */}
          {isDone && result && (
            <div className="space-y-5">
              {/* Verification highlight banner */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  Verified Playable MP4 Video
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                  <div>• Major Brand: <span className="font-mono text-white">{result.validation.majorBrand}</span></div>
                  <div>• Resolution: <span className="font-mono text-white">{result.width}x{result.height}</span></div>
                  <div>• File Size: <span className="font-mono text-white">{(result.blob.size / 1024 / 1024).toFixed(2)} MB</span></div>
                  <div>• Duration: <span className="font-mono text-white">{result.durationSeconds.toFixed(1)}s</span></div>
                  <div>• Video Codec: <span className="font-mono text-white">H.264 (AVC)</span></div>
                  <div>• Audio: <span className="font-mono text-white">{result.validation.hasAudioTrack ? 'AAC Included' : 'Clean Bitstream'}</span></div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => downloadMp4Blob(result.blob, `quiz_video_${Date.now()}.mp4`)}
                  className="w-full py-3.5 px-4 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
                >
                  <Download className="w-5 h-5" />
                  Download Verified MP4 Video
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDiagnostics(true)}
                    className="flex-1 py-2.5 px-3 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs transition"
                  >
                    <FileCode className="w-4 h-4 text-sky-400" />
                    Inspect Atoms & Hex
                  </button>

                  <button
                    onClick={onClose}
                    className="py-2.5 px-4 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="space-y-4">
              <div className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-xl text-xs text-rose-300">
                <p className="font-semibold mb-1">Export Failed:</p>
                <p className="font-mono">{progress.error || progress.message}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onRetry}
                  className="flex-1 py-2.5 px-4 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 text-xs transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Export
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diagnostics Modal */}
      {showDiagnostics && result && (
        <Mp4DiagnosticsModal
          validation={result.validation}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </>
  );
};
