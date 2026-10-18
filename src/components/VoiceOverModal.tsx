import React, { useEffect, useState } from 'react';
import { QuizConfig, QuizQuestion, VoiceOverConfig, VoiceLanguage } from '../types/quiz';
import { voiceOverService, VoiceOption } from '../utils/voiceOverService';
import { previewAudio } from '../utils/audioSynth';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  CheckCircle2,
  Languages,
  Sliders,
  RotateCcw,
  BookOpen,
  Info,
  Mic,
  AlertCircle,
  Headphones,
} from 'lucide-react';

interface Props {
  quiz: QuizConfig;
  isOpen: boolean;
  onClose: () => void;
  onUpdateVoiceOver: (config: VoiceOverConfig) => void;
  onLoadMalayalamSample?: () => void;
  activeQuestionIndex: number;
  setActiveQuestionIndex: (index: number) => void;
}

export const VoiceOverModal: React.FC<Props> = ({
  quiz,
  isOpen,
  onClose,
  onUpdateVoiceOver,
  onLoadMalayalamSample,
  activeQuestionIndex,
  setActiveQuestionIndex,
}) => {
  const currentConfig: VoiceOverConfig = quiz.voiceOver || {
    enabled: true,
    language: 'auto',
    rate: 0.95,
    pitch: 1.0,
    volume: 1.0,
    readQuestion: true,
    readStatements: true,
    readOptions: true,
    announceAnswerOnReveal: true,
    readExplanation: true,
  };

  const [voices, setVoices] = useState<{
    malayalam: VoiceOption[];
    english: VoiceOption[];
    other: VoiceOption[];
  }>({
    malayalam: [],
    english: [],
    other: [],
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<
    'idle' | 'reading_question' | 'waiting_timer' | 'revealing_answer'
  >('idle');
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const [activeSpeechText, setActiveSpeechText] = useState<string>('');
  const [auditioningVoiceURI, setAuditioningVoiceURI] = useState<string | null>(null);

  // In-browser microphone recording state
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const loadVoices = () => {
      setVoices(voiceOverService.getCategorizedVoices());
    };
    loadVoices();
    const unsubscribe = voiceOverService.subscribeState((speaking, text) => {
      setIsPlaying((prev) => (prev !== speaking ? speaking : prev));
      if (text) setActiveSpeechText(text);
      if (!speaking && currentPhase === 'idle') {
        setActiveSpeechText('');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, currentPhase]);

  if (!isOpen) return null;

  const currentQuestion: QuizQuestion = quiz.questions[activeQuestionIndex] || quiz.questions[0];
  const narrationScripts = currentQuestion
    ? voiceOverService.buildNarrationScripts(currentQuestion, currentConfig)
    : { questionScript: '', revealScript: '', isMalayalam: false };

  const updateConfig = (updated: Partial<VoiceOverConfig>) => {
    onUpdateVoiceOver({ ...currentConfig, ...updated });
  };

  /**
   * Complete Question Narration Audition with STRICT Sequenced Timing:
   * Phase 1: Question & Options reading (voice speaks, timer does NOT start)
   * Phase 2: Voice is OVER -> Countdown timer begins (4... 3... 2... 1... with audio ticks)
   * Phase 3: Timer is 0 -> Reveal correct answer & explanation
   */
  const handleTestFullVoiceOver = async () => {
    if (!currentQuestion) return;
    if (isPlaying || currentPhase !== 'idle') {
      voiceOverService.stop();
      setIsPlaying(false);
      setCurrentPhase('idle');
      return;
    }

    try {
      setIsPlaying(true);
      await voiceOverService.checkQuestionVoiceOver(
        currentQuestion,
        currentConfig,
        quiz.countdownDuration || 4.0,
        (phase, countdownVal, text) => {
          if (phase === 'done') {
            setCurrentPhase('idle');
            setIsPlaying(false);
            setActiveSpeechText('');
            return;
          }
          setCurrentPhase(phase);
          if (countdownVal !== undefined) {
            setCountdownRemaining(countdownVal);
          }
          if (phase === 'reading_question') {
            if (text) setActiveSpeechText(text);
          } else if (phase === 'waiting_timer') {
            setActiveSpeechText(`⏳ Voice is over! Countdown Timer begins ticking: ${countdownVal}s...`);
          } else if (phase === 'revealing_answer') {
            if (text) setActiveSpeechText(text);
          }
        },
        () => {
          previewAudio.playTick();
        }
      );
    } catch (e) {
      console.error('Voice-over check error:', e);
      setIsPlaying(false);
      setCurrentPhase('idle');
    }
  };

  const handleTestQuestionOnly = () => {
    if (isPlaying) voiceOverService.stop();
    setCurrentPhase('reading_question');
    voiceOverService.speakText(narrationScripts.questionScript, currentConfig, () => {
      setCurrentPhase('idle');
    });
  };

  const handleTestRevealOnly = () => {
    if (isPlaying) voiceOverService.stop();
    setCurrentPhase('revealing_answer');
    voiceOverService.speakText(narrationScripts.revealScript, currentConfig, () => {
      setCurrentPhase('idle');
    });
  };

  const handleStop = () => {
    voiceOverService.stop();
    setIsPlaying(false);
    setCurrentPhase('idle');
    setActiveSpeechText('');
  };

  const handleTestSingleVoice = async (v: VoiceOption) => {
    setAuditioningVoiceURI(v.voice.voiceURI);
    await voiceOverService.testSingleVoice(v.voice, v.isMalayalam || narrationScripts.isMalayalam);
    setAuditioningVoiceURI(null);
  };

  // Toggle in-browser microphone recording
  const handleToggleMicRecord = async () => {
    if (isRecordingMic) {
      const result = await voiceOverService.stopMicRecording();
      setIsRecordingMic(false);
      if (result) {
        setRecordedAudioUrl(result.audioUrl);
      }
    } else {
      const ok = await voiceOverService.startMicRecording();
      if (ok) {
        setIsRecordingMic(true);
      }
    }
  };

  const hasMalayalamVoices = voices.malayalam.length > 0;
  const naturalVoices = [...voices.malayalam, ...voices.english].filter((v) => v.isNatural);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Natural Voice-Over & Audio Narration
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  100% Free • Zero Paid APIs • Client-Side
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Natural human voices for Malayalam (മലയാളം) & English: reads question, options, waits for timer, then reveals answer.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              voiceOverService.stop();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5">
          {/* Important Guidance Note on Natural Voices */}
          <div className="bg-gradient-to-r from-sky-950/60 to-indigo-950/60 border border-sky-500/30 rounded-xl p-3.5 text-xs text-sky-200 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-white text-sm">
                How to get the most natural, human-sounding voiceover:
              </span>
              <p className="text-slate-300 leading-relaxed">
                For the highest quality natural voices with zero robot tone, use <strong>Microsoft Edge</strong> (features free online natural voices like <em>Microsoft Midhun / Sobhana Natural</em> for Malayalam, and <em>Microsoft Jenny / Guy Natural</em> for English) or <strong>Google Chrome</strong> (<em>Google മലയാളം</em> and <em>Google US/UK English</em>). Pitch is locked at 1.0 to preserve neural clarity.
              </p>
            </div>
          </div>

          {/* 1. Live Question Audition & Sequenced Timing Player */}
          <div className="bg-slate-950/80 border border-indigo-500/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-xs">
                  Auditioning Question {activeQuestionIndex + 1}
                </span>
                <span className="text-xs text-slate-400 truncate max-w-[240px]">
                  {currentQuestion?.question}
                </span>
              </div>

              {/* Question Switcher */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {quiz.questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      voiceOverService.stop();
                      setIsPlaying(false);
                      setCurrentPhase('idle');
                      setActiveQuestionIndex(i);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      i === activeQuestionIndex
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Q{i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Strict Sequenced Timing Explanation Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div
                className={`p-2.5 rounded-xl border transition ${
                  currentPhase === 'reading_question'
                    ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-500/20 ring-1 ring-sky-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <span>🎙️ Phase 1: Question & Options</span>
                </div>
                <p className="text-[11px] opacity-80">
                  Voice speaks question and options. <strong>Timer holds steady at 4s!</strong>
                </p>
              </div>

              <div
                className={`p-2.5 rounded-xl border transition ${
                  currentPhase === 'waiting_timer'
                    ? 'bg-amber-950/60 border-amber-500 text-white shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <span>⏳ Phase 2: Countdown Timer</span>
                </div>
                <p className="text-[11px] opacity-80">
                  <strong>Only after voice finishes</strong>, the countdown begins ticking: {countdownRemaining > 0 ? `${countdownRemaining}s` : '4... 3... 2... 1'}!
                </p>
              </div>

              <div
                className={`p-2.5 rounded-xl border transition ${
                  currentPhase === 'revealing_answer'
                    ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <span>✅ Phase 3: Answer Reveal</span>
                </div>
                <p className="text-[11px] opacity-80">
                  Countdown hits 0! Green card reveals, fanfare plays, voice announces correct answer.
                </p>
              </div>
            </div>

            {/* Real-time Subtitles / Active Speech Bar */}
            {activeSpeechText && (
              <div className="bg-indigo-950/50 border border-indigo-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-sky-200 animate-in fade-in">
                <Volume2 className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
                <span className="font-medium leading-relaxed">{activeSpeechText}</span>
              </div>
            )}

            {/* Test Action Controls */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleTestFullVoiceOver}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-md active:scale-95 ${
                  isPlaying || currentPhase !== 'idle'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/25'
                }`}
              >
                {isPlaying || currentPhase !== 'idle' ? (
                  <>
                    <Square className="w-4 h-4 fill-white" />
                    <span>
                      {currentPhase === 'reading_question' && '⏹ Stop Voice (Phase 1: Reading)'}
                      {currentPhase === 'waiting_timer' && `⏹ Stop Voice (Phase 2: Timer ${countdownRemaining}s)`}
                      {currentPhase === 'revealing_answer' && '⏹ Stop Voice (Phase 3: Revealing)'}
                      {currentPhase === 'idle' && '⏹ Stop Voice-Over'}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>▶ Check Full Sequenced Voice-Over (Voice ➔ Timer ➔ Answer)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleTestQuestionOnly}
                disabled={isPlaying}
                className="px-3 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition disabled:opacity-40"
                title="Speak only Question and Options"
              >
                Read Question Only
              </button>

              <button
                onClick={handleTestRevealOnly}
                disabled={isPlaying}
                className="px-3 py-2.5 rounded-xl font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs transition disabled:opacity-40"
                title="Speak only Correct Answer Reveal"
              >
                Announce Answer Only
              </button>
            </div>
          </div>

          {/* 2. Voice Model Selection & Audition Section */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Sliders className="w-4 h-4 text-sky-400" />
                <span>Select Voice Model & Language</span>
              </div>

              {onLoadMalayalamSample && (
                <button
                  onClick={onLoadMalayalamSample}
                  className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>Load Malayalam Sample Quiz</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Language Selection */}
              <div>
                <label className="font-semibold text-slate-300 mb-1.5 block">
                  Narration Language:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => updateConfig({ language: 'auto' })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs border text-center transition ${
                      currentConfig.language === 'auto'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Auto-Detect
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig({ language: 'en' })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs border text-center transition ${
                      currentConfig.language === 'en'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig({ language: 'ml' })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs border text-center transition ${
                      currentConfig.language === 'ml'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    മലയാളം (ML)
                  </button>
                </div>
              </div>

              {/* Speech Speed / Cadence */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1 font-semibold">
                  <span>Speech Cadence (Speed):</span>
                  <span className="font-mono text-sky-400">{currentConfig.rate}x</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.25}
                  step={0.05}
                  value={currentConfig.rate}
                  onChange={(e) => updateConfig({ rate: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>0.8x (Deliberate)</span>
                  <span>0.95x (Natural Human)</span>
                  <span>1.25x (Fast)</span>
                </div>
              </div>
            </div>

            {/* Voice Dropdown with Instant Listen Button */}
            <div>
              <label className="font-semibold text-slate-300 mb-1.5 flex items-center justify-between text-xs">
                <span>Selected Voice Model:</span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  Neural Online Preferred
                </span>
              </label>

              <div className="flex items-center gap-2">
                <select
                  value={currentConfig.voiceURI || ''}
                  onChange={(e) => updateConfig({ voiceURI: e.target.value || undefined })}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">(Recommended) Auto-select Best Natural Voice</option>

                  {voices.malayalam.length > 0 && (
                    <optgroup label="Malayalam Voices (മലയാളം)">
                      {voices.malayalam.map((v) => (
                        <option key={v.voice.voiceURI} value={v.voice.voiceURI}>
                          {v.name} ({v.lang}) {v.isNatural ? '⭐ [Natural Neural]' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  <optgroup label="English Natural Voices (Recommended)">
                    {voices.english
                      .filter((v) => v.isNatural)
                      .map((v) => (
                        <option key={v.voice.voiceURI} value={v.voice.voiceURI}>
                          ⭐ {v.name} ({v.lang})
                        </option>
                      ))}
                  </optgroup>

                  <optgroup label="All Device Voices">
                    {voices.english
                      .filter((v) => !v.isNatural)
                      .map((v) => (
                        <option key={v.voice.voiceURI} value={v.voice.voiceURI}>
                          {v.name} ({v.lang}) {v.isRoboticLegacy ? '🤖 [Legacy Robotic]' : ''}
                        </option>
                      ))}
                  </optgroup>
                </select>

                {/* Instant Sample Button for currently selected voice */}
                <button
                  type="button"
                  onClick={() => {
                    const chosen = voiceOverService.getBestVoice(
                      currentConfig.language,
                      currentQuestion?.question || '',
                      currentConfig.voiceURI
                    );
                    if (chosen) {
                      voiceOverService.testSingleVoice(
                        chosen,
                        currentConfig.language === 'ml' || narrationScripts.isMalayalam
                      );
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                  title="Hear a short test sentence from this voice"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>▶ Listen</span>
                </button>
              </div>
            </div>

            {/* Quick Audition List of Available Voices on This Machine */}
            <div className="pt-2">
              <span className="text-[11px] font-bold text-slate-400 block mb-2">
                Available Voices on your Device (Click ▶ to Audition):
              </span>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {naturalVoices.length > 0 ? (
                  naturalVoices.slice(0, 8).map((v) => (
                    <div
                      key={v.voice.voiceURI}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs transition ${
                        currentConfig.voiceURI === v.voice.voiceURI
                          ? 'bg-indigo-950/50 border-indigo-500 text-white'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-emerald-400 font-bold shrink-0">⭐</span>
                        <span className="font-semibold truncate">{v.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {v.lang}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTestSingleVoice(v)}
                          disabled={auditioningVoiceURI === v.voice.voiceURI}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-bold flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Sample</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConfig({ voiceURI: v.voice.voiceURI })}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            currentConfig.voiceURI === v.voice.voiceURI
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          {currentConfig.voiceURI === v.voice.voiceURI ? 'Selected' : 'Use Voice'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-xs">
                    Your current browser does not report online neural voices. For ultra-natural voices (like Microsoft Natural Midhun/Sobhana/Jenny/Guy), open in Microsoft Edge or Google Chrome.
                  </div>
                )}
              </div>
            </div>

            {/* 3. In-Browser Microphone Studio Recording (100% Genuine Human Voice) */}
            <div className="pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Mic className="w-4 h-4 text-rose-400" />
                  <span>100% Genuine Human Voice: In-Browser Microphone Recording</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Optional: Record your own authentic narration
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-slate-300">
                  {isRecordingMic ? (
                    <span className="text-rose-400 font-bold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      Recording your microphone now... Speak clearly!
                    </span>
                  ) : recordedAudioUrl ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Voice recorded successfully! You can listen below.
                    </span>
                  ) : (
                    <span>Tap record to capture your real voice for Question {activeQuestionIndex + 1}.</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleMicRecord}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                      isRecordingMic
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>{isRecordingMic ? 'Stop Recording' : 'Record My Voice'}</span>
                  </button>

                  {recordedAudioUrl && (
                    <audio src={recordedAudioUrl} controls className="h-8 max-w-[200px]" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Voice-over settings are automatically saved</span>
          </div>

          <button
            onClick={() => {
              voiceOverService.stop();
              onClose();
            }}
            className="px-5 py-2 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
