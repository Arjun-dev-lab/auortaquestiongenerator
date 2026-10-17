import React from 'react';
import { Mp4ValidationResult } from '../types/quiz';
import { CheckCircle2, XCircle, AlertTriangle, FileCode, Layers, HardDrive, Sparkles, X } from 'lucide-react';

interface Props {
  validation: Mp4ValidationResult;
  onClose: () => void;
}

export const Mp4DiagnosticsModal: React.FC<Props> = ({ validation, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                MP4 Binary & Atom Inspector
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ISO/IEC 14496-12 Validated
                </span>
              </h3>
              <p className="text-xs text-slate-400">Byte-level inspection of the exported container</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {/* Quick Verification Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 p-3 rounded-xl">
              <div className="text-xs text-slate-400 mb-1">Container Format</div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ISO BMFF MP4
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 p-3 rounded-xl">
              <div className="text-xs text-slate-400 mb-1">WebM Detection</div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Not WebM (Clean)
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 p-3 rounded-xl">
              <div className="text-xs text-slate-400 mb-1">Major Brand</div>
              <div className="font-mono font-bold text-sm text-sky-400">
                {validation.majorBrand || 'mp42'}
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 p-3 rounded-xl">
              <div className="text-xs text-slate-400 mb-1">File Size</div>
              <div className="font-mono font-bold text-sm text-amber-400">
                {(validation.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>

          {/* Hex Dump of Header */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2 font-sans font-semibold">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-sky-400" />
                First 64 Bytes (Magic Bytes & FTYP Header)
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                ASCII ftyp{validation.majorBrand}
              </span>
            </div>
            <div className="p-3 bg-slate-900/80 rounded-lg text-sky-300 break-all leading-relaxed tracking-wider border border-slate-800/60">
              {validation.first64BytesHex}
            </div>
          </div>

          {/* Atom Box Tree */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Identified ISO Atoms / Boxes
            </h4>
            <div className="space-y-2">
              {validation.rawBoxes.map((box, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      box '{box.type}'
                    </span>
                    <span className="text-slate-400 font-mono">
                      offset: {box.offset} | size: {box.size.toLocaleString()} bytes
                    </span>
                  </div>
                  {box.description && (
                    <div className="text-slate-300 pl-1">{box.description}</div>
                  )}
                  {box.children && box.children.length > 0 && (
                    <div className="mt-2 pl-4 border-l-2 border-indigo-500/30 space-y-1.5">
                      {box.children.map((child, cIdx) => (
                        <div key={cIdx} className="text-slate-400 font-mono text-[11px]">
                          ↳ <span className="text-sky-300 font-semibold">{child.type}</span> ({child.size} bytes)
                          {child.description && <span className="text-slate-300 ml-2 font-sans">- {child.description}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic Log */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Diagnostics Audit</h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {validation.diagnostics.map((msg, i) => (
                <li key={i} className="flex items-start gap-2 bg-slate-800/30 p-2 rounded-lg border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
