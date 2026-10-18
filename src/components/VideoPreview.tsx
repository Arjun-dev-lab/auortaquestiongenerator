import React, { useEffect, useRef, useState } from 'react';
import { QuizConfig, QuizQuestion } from '../types/quiz';
import { previewAudio } from '../utils/audioSynth';
import {
  renderQuizFrame,
  getQuizQuestionsTiming,
  calculateQuizTotalDuration,
} from '../utils/canvasRenderer';
import { voiceOverService } from '../utils/voiceOverService';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Smartphone,
  Tv,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  Sparkles,
  FileCode,
  Layers,
  Plus,
  Mic,
  Square,
  Languages,
} from 'lucide-react';

interface Props {
  quiz: QuizConfig;
  onUpdateQuiz: (quiz: QuizConfig) => void;
  onExportClick: () => void;
  onOpenJsonModal?: () => void;
  onOpenVoiceOverModal?: () => void;
  isExporting: boolean;
  activeQuestionIndex: number;
  setActiveQuestionIndex: (index: number) => void;
}

export const VideoPreview: React.FC<Props> = ({
  quiz,
  onUpdateQuiz,
  onExportClick,
  onOpenJsonModal,
  onOpenVoiceOverModal,
  isExporting,
  activeQuestionIndex,
  setActiveQuestionIndex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showQuickEditor, setShowQuickEditor] = useState(true);
  const [isVoiceOverSpeaking, setIsVoiceOverSpeaking] = useState(false);
  const [autoNarrateInPreview, setAutoNarrateInPreview] = useState(false);

  // Live Audition State for strictly sequenced voice checking
  const [isAuditioningVoice, setIsAuditioningVoice] = useState(false);
  const [auditionPhase, setAuditionPhase] = useState<
    'idle' | 'reading_question' | 'waiting_timer' | 'revealing_answer'
  >('idle');
  const [auditionRemainingSecs, setAuditionRemainingSecs] = useState<number>(0);

  const isPortrait = quiz.aspectRatio === '9:16';
  const width = isPortrait ? 720 : 1280;
  const height = isPortrait ? 1280 : 720;

  const totalDuration = calculateQuizTotalDuration(quiz);

  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastSoundTriggerRef = useRef<{ [key: string]: boolean }>({});
  const lastNarrationTriggerRef = useRef<{ [key: string]: boolean }>({});

  // Sync mute state with audio engine
  useEffect(() => {
    previewAudio.setMuted(isMuted);
  }, [isMuted]);

  // Subscribe to voiceOver speaking state
  useEffect(() => {
    const unsub = voiceOverService.subscribeState((speaking) => {
      setIsVoiceOverSpeaking((prev) => (prev !== speaking ? speaking : prev));
    });
    return () => {
      unsub();
    };
  }, []);

  // Main playback animation loop with Sequenced Timing
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (autoNarrateInPreview) voiceOverService.stop();
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const dt = ((now - lastTimeRef.current) / 1000) * playbackSpeed;
      lastTimeRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= totalDuration) {
          setIsPlaying(false);
          lastSoundTriggerRef.current = {};
          lastNarrationTriggerRef.current = {};
          if (autoNarrateInPreview) voiceOverService.stop();
          return totalDuration;
        }

        // Sound triggers and Voice-Over triggers during sequenced playback
        const timings = getQuizQuestionsTiming(quiz);
        timings.forEach((timing) => {
          const q = quiz.questions[timing.index];
          if (!q) return;

          // 1. Voice-Over Narration trigger at question start (Phase 1: Reading)
          if (autoNarrateInPreview) {
            const narrateQKey = `narration_q_${timing.index}`;
            if (
              prev < timing.startTime + 0.1 &&
              next >= timing.startTime + 0.1 &&
              !lastNarrationTriggerRef.current[narrateQKey]
            ) {
              lastNarrationTriggerRef.current[narrateQKey] = true;
              const voConfig = quiz.voiceOver || {
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
              const scripts = voiceOverService.buildNarrationScripts(q, voConfig);
              voiceOverService.speakText(scripts.questionScript, voConfig);
            }
          }

          // 2. Countdown Ticks: ONLY during Phase 2 (timing.countdownStart -> timing.revealStart)
          // NEVER during the reading phase! Voice is over -> Countdown begins!
          for (let s = 0; s < Math.floor(timing.countdownDuration); s++) {
            const tickT = timing.countdownStart + s;
            const key = `tick_${timing.index}_${s}`;
            if (prev < tickT && next >= tickT && !lastSoundTriggerRef.current[key]) {
              lastSoundTriggerRef.current[key] = true;
              previewAudio.playTick();
            }
          }

          // 3. Reveal sound & Reveal voiceover at timing.revealStart (Phase 3: Reveal)
          const revealKey = `reveal_${timing.index}`;
          if (
            prev < timing.revealStart &&
            next >= timing.revealStart &&
            !lastSoundTriggerRef.current[revealKey]
          ) {
            lastSoundTriggerRef.current[revealKey] = true;
            previewAudio.playReveal();

            if (autoNarrateInPreview) {
              const voConfig = quiz.voiceOver || {
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
              const scripts = voiceOverService.buildNarrationScripts(q, voConfig);
              voiceOverService.speakText(scripts.revealScript, voConfig);
            }
          }
        });

        // Final screen fanfare
        const finalScreenStart = Math.max(0, totalDuration - quiz.finalScreenDuration);
        const finalKey = 'final_fanfare';
        if (
          prev < finalScreenStart &&
          next >= finalScreenStart &&
          !lastSoundTriggerRef.current[finalKey]
        ) {
          lastSoundTriggerRef.current[finalKey] = true;
          previewAudio.playFinal();
        }

        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDuration, quiz, autoNarrateInPreview]);

  // Track active question during playback based on currentTime using exact timings
  useEffect(() => {
    if (!isPlaying) return;
    const timings = getQuizQuestionsTiming(quiz);
    for (let i = 0; i < timings.length; i++) {
      const t = timings[i];
      if (currentTime >= t.startTime && currentTime < t.startTime + t.totalDuration) {
        if (activeQuestionIndex !== i) {
          setActiveQuestionIndex(i);
        }
        break;
      }
    }
  }, [currentTime, isPlaying, quiz, activeQuestionIndex, setActiveQuestionIndex]);

  // Render canvas whenever currentTime or quiz changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderQuizFrame(ctx as any, quiz, currentTime, width, height);
  }, [currentTime, quiz, width, height]);

  const handlePlayPause = () => {
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
      lastSoundTriggerRef.current = {};
      lastNarrationTriggerRef.current = {};
    }
    if (isPlaying || isAuditioningVoice) {
      voiceOverService.stop();
      setIsAuditioningVoice(false);
      setAuditionPhase('idle');
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    voiceOverService.stop();
    setIsPlaying(false);
    setIsAuditioningVoice(false);
    setAuditionPhase('idle');
    setCurrentTime(0);
    lastSoundTriggerRef.current = {};
    lastNarrationTriggerRef.current = {};
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    lastSoundTriggerRef.current = {};
    lastNarrationTriggerRef.current = {};
    voiceOverService.stop();
    setIsAuditioningVoice(false);
    setAuditionPhase('idle');
  };

  const toggleAspectRatio = () => {
    onUpdateQuiz({
      ...quiz,
      aspectRatio: isPortrait ? '16:9' : '9:16',
    });
  };

  // Jump canvas to specific question phase
  const jumpToQuestion = (
    qIndex: number,
    phase: 'reading' | 'countdown' | 'reveal' = 'reading'
  ) => {
    voiceOverService.stop();
    setIsPlaying(false);
    setIsAuditioningVoice(false);
    setAuditionPhase('idle');
    setActiveQuestionIndex(qIndex);

    const timings = getQuizQuestionsTiming(quiz);
    const timing = timings[qIndex];
    if (!timing) return;

    let targetTime = timing.startTime + 0.05;
    if (phase === 'countdown') {
      targetTime = timing.countdownStart + 0.05;
    } else if (phase === 'reveal') {
      targetTime = timing.revealStart + 0.05;
    }

    setCurrentTime(Math.min(totalDuration, targetTime));
    lastSoundTriggerRef.current = {};
    lastNarrationTriggerRef.current = {};
  };

  // Jump canvas to final screen
  const jumpToFinalScreen = () => {
    voiceOverService.stop();
    setIsPlaying(false);
    setIsAuditioningVoice(false);
    setAuditionPhase('idle');
    const finalStart = Math.max(0, totalDuration - quiz.finalScreenDuration + 0.1);
    setCurrentTime(finalStart);
    lastSoundTriggerRef.current = {};
    lastNarrationTriggerRef.current = {};
  };

  /**
   * DIRECT LIVE VOICE-OVER CHECK ON ACTIVE QUESTION
   * Strictly enforces Sequenced Timing:
   * 1. Voice reads Question & Options (Timer holds steady, not ticking!)
   * 2. Voice is OVER -> Countdown Timer begins (4... 3... 2... 1... with audio ticks)
   * 3. Countdown reaches 0 -> Answer reveals, fanfare plays, voice announces correct answer & solution!
   */
  const handleCheckVoiceOverClick = async () => {
    if (isAuditioningVoice || isVoiceOverSpeaking) {
      voiceOverService.stop();
      setIsAuditioningVoice(false);
      setAuditionPhase('idle');
      return;
    }

    const currentQ = quiz.questions[activeQuestionIndex];
    if (!currentQ) return;

    setIsPlaying(false);
    setIsAuditioningVoice(true);
    setAuditionPhase('reading_question');

    const timings = getQuizQuestionsTiming(quiz);
    const timing = timings[activeQuestionIndex] || timings[0];

    const voConfig = quiz.voiceOver || {
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

    // Position canvas at start of reading phase
    setCurrentTime(timing.startTime + 0.05);

    try {
      await voiceOverService.checkQuestionVoiceOver(
        currentQ,
        voConfig,
        quiz.countdownDuration || 4.0,
        (phase, countdownVal) => {
          if (phase === 'done') {
            setIsAuditioningVoice(false);
            setAuditionPhase('idle');
            return;
          }
          setAuditionPhase(phase);
          if (countdownVal !== undefined) {
            setAuditionRemainingSecs(countdownVal);
          }

          if (phase === 'reading_question') {
            // Keep canvas in reading phase (timer steady at full countdown, showing LISTEN)
            setCurrentTime(timing.startTime + 0.05);
          } else if (phase === 'waiting_timer') {
            // Voice is over! Timer begins ticking!
            const elapsedInTimer = (quiz.countdownDuration || 4.0) - (countdownVal || 0);
            setCurrentTime(timing.countdownStart + Math.max(0, elapsedInTimer));
          } else if (phase === 'revealing_answer') {
            // Countdown over! Answer revealed!
            setCurrentTime(timing.revealStart + 0.1);
          } else if (phase === 'done') {
            setIsAuditioningVoice(false);
            setAuditionPhase('idle');
          }
        },
        () => {
          previewAudio.playTick();
        }
      );
    } catch (err) {
      console.error('Audition error:', err);
      setIsAuditioningVoice(false);
      setAuditionPhase('idle');
    }
  };

  // Add a new question right in front of the canvas
  const handleAddQuestion = () => {
    const newIndex = quiz.questions.length;
    const newQ: QuizQuestion = {
      id: `q_${Date.now()}`,
      question: `New Question #${newIndex + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: newIndex % 4,
      explanationLabel: 'Solution',
      explanation: 'Step-by-step solution for the correct answer.',
    };
    const nextQuestions = [...quiz.questions, newQ];
    onUpdateQuiz({ ...quiz, questions: nextQuestions });
    setActiveQuestionIndex(newIndex);

    const timings = getQuizQuestionsTiming({ ...quiz, questions: nextQuestions });
    const newTiming = timings[newIndex];
    if (newTiming) {
      setCurrentTime(newTiming.startTime);
    }
  };

  // Remove the active question right in front of the canvas
  const handleRemoveQuestion = (indexToRemove: number) => {
    if (quiz.questions.length <= 1) return;
    const nextQuestions = quiz.questions.filter((_, i) => i !== indexToRemove);
    onUpdateQuiz({ ...quiz, questions: nextQuestions });
    const nextActive = Math.max(0, Math.min(indexToRemove, nextQuestions.length - 1));
    setActiveQuestionIndex(nextActive);

    const timings = getQuizQuestionsTiming({ ...quiz, questions: nextQuestions });
    const nextTiming = timings[nextActive];
    if (nextTiming) {
      setCurrentTime(nextTiming.startTime);
    }
  };

  // Update field of active question
  const updateActiveQuestion = (updated: Partial<QuizQuestion>) => {
    const nextQuestions = [...quiz.questions];
    if (activeQuestionIndex >= 0 && activeQuestionIndex < nextQuestions.length) {
      nextQuestions[activeQuestionIndex] = {
        ...nextQuestions[activeQuestionIndex],
        ...updated,
      };
      onUpdateQuiz({ ...quiz, questions: nextQuestions });
    }
  };

  // Update option of active question
  const updateActiveOption = (optIndex: number, text: string) => {
    const nextQuestions = [...quiz.questions];
    if (activeQuestionIndex >= 0 && activeQuestionIndex < nextQuestions.length) {
      const q = nextQuestions[activeQuestionIndex];
      const opts = [...q.options] as [string, string, string, string];
      opts[optIndex] = text;
      nextQuestions[activeQuestionIndex] = { ...q, options: opts };
      onUpdateQuiz({ ...quiz, questions: nextQuestions });
    }
  };

  // Quick statement helpers for inline editor
  const addActiveStatement = () => {
    const q = quiz.questions[activeQuestionIndex];
    if (!q) return;
    const stmts = q.statements ? [...q.statements] : [];
    stmts.push(`${stmts.length + 1}. New Statement`);
    updateActiveQuestion({
      statements: stmts,
      questionFooter: q.questionFooter || 'Which of the statements given above is/are correct?',
    });
  };

  const updateActiveStatement = (stmtIdx: number, text: string) => {
    const q = quiz.questions[activeQuestionIndex];
    if (!q || !q.statements) return;
    const stmts = [...q.statements];
    stmts[stmtIdx] = text;
    updateActiveQuestion({ statements: stmts });
  };

  const removeActiveStatement = (stmtIdx: number) => {
    const q = quiz.questions[activeQuestionIndex];
    if (!q || !q.statements) return;
    const stmts = q.statements.filter((_, i) => i !== stmtIdx);
    updateActiveQuestion({
      statements: stmts.length > 0 ? stmts : undefined,
    });
  };

  const formatTime = (secs: number) => {
    const s = Math.floor(secs);
    const ms = Math.floor((secs % 1) * 10);
    return `${s.toString().padStart(2, '0')}.${ms}s`;
  };

  const activeQuestion = quiz.questions[activeQuestionIndex] || quiz.questions[0];
  const hasStatements = Boolean(activeQuestion?.statements && activeQuestion.statements.length > 0);
  const isMalayalam = activeQuestion
    ? voiceOverService.isMalayalamText(
        `${activeQuestion.question} ${activeQuestion.statements?.join(' ') || ''}`
      )
    : false;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-5 lg:p-6 flex flex-col shadow-xl">
      {/* 1. TOP HEADER & QUESTION NAVIGATION BAR (Directly above canvas) */}
      <div className="pb-3 mb-3 border-b border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-sm sm:text-base">Video Preview</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
              {width}x{height}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Aspect Ratio Switch */}
            <button
              onClick={toggleAspectRatio}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              title="Switch Aspect Ratio"
            >
              {isPortrait ? (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                  <span>9:16 Shorts</span>
                </>
              ) : (
                <>
                  <Tv className="w-3.5 h-3.5 text-sky-400" />
                  <span>16:9 Normal</span>
                </>
              )}
            </button>

            {/* DIRECT VOICE-OVER CHECK BUTTON WITH STRICT SEQUENCED TIMING */}
            <button
              onClick={handleCheckVoiceOverClick}
              className={`py-1.5 px-3 rounded-lg border flex items-center gap-1.5 text-xs font-bold transition shadow-sm ${
                isAuditioningVoice
                  ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-rose-600/30'
                  : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
              }`}
              title="Audition voice-over: Voice speaks Question -> Voice finishes -> Countdown Timer begins -> Answer revealed"
            >
              {isAuditioningVoice ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-white text-white" />
                  <span>
                    {auditionPhase === 'reading_question' && '🎙️ Reading (Timer Paused)...'}
                    {auditionPhase === 'waiting_timer' && `⏳ Timer Ticking (${auditionRemainingSecs}s)...`}
                    {auditionPhase === 'revealing_answer' && '🎉 Revealing Answer...'}
                    {auditionPhase === 'idle' && '⏹ Stop Voice'}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-sky-400" />
                  <span>🎙️ Check Voice-Over</span>
                </>
              )}
            </button>

            {/* Voice-Over Settings Modal Button */}
            {onOpenVoiceOverModal && (
              <button
                onClick={onOpenVoiceOverModal}
                className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
                title="Configure Natural Voice & Language (Malayalam / English)"
              >
                <Languages className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Voice & Audio</span>
              </button>
            )}

            {/* Paste JSON button directly above canvas */}
            {onOpenJsonModal && (
              <button
                onClick={onOpenJsonModal}
                className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 text-xs font-semibold transition"
                title="Paste questions in JSON format"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Paste JSON</span>
              </button>
            )}

            {/* Export MP4 button */}
            <button
              onClick={onExportClick}
              disabled={isExporting}
              className="py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 text-xs transition active:scale-95 disabled:opacity-50"
            >
              Export MP4
            </button>
          </div>
        </div>

        {/* Live Status Pill when Auditioning Voice */}
        {isAuditioningVoice && (
          <div className="bg-indigo-950/70 border border-indigo-500/40 rounded-xl px-3 py-2 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-white">
                {auditionPhase === 'reading_question' &&
                  'Phase 1: Voice is reading Question & Options (Timer holds steady)'}
                {auditionPhase === 'waiting_timer' &&
                  `Phase 2: Voice is OVER -> Countdown Timer begins ticking (${auditionRemainingSecs}s)`}
                {auditionPhase === 'revealing_answer' &&
                  'Phase 3: Countdown finished -> Correct Answer revealed with Voice Announcement'}
              </span>
            </div>
            <button
              onClick={() => {
                voiceOverService.stop();
                setIsAuditioningVoice(false);
                setAuditionPhase('idle');
              }}
              className="px-2 py-0.5 rounded bg-rose-600/30 text-rose-300 font-bold hover:bg-rose-600/50"
            >
              Cancel Audition
            </button>
          </div>
        )}

        {/* Question Selector Chips & Add Question Button */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Scenes:
          </span>

          {quiz.questions.map((q, idx) => {
            const isActive = idx === activeQuestionIndex;
            const hasMl = voiceOverService.isMalayalamText(q.question);
            return (
              <div key={q.id || idx} className="flex items-center shrink-0">
                <button
                  onClick={() => jumpToQuestion(idx, 'reading')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title={`Jump to Question ${idx + 1}`}
                >
                  <span>Q{idx + 1}</span>
                  {hasMl && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                      മല
                    </span>
                  )}
                  {q.statements && q.statements.length > 0 && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300">
                      Stmt
                    </span>
                  )}
                  <span className="max-w-[70px] sm:max-w-[110px] truncate opacity-80 hidden xs:inline">
                    {q.question || `Question ${idx + 1}`}
                  </span>
                </button>

                {/* Direct Remove Question button if more than 1 question */}
                {quiz.questions.length > 1 && (
                  <button
                    onClick={() => handleRemoveQuestion(idx)}
                    className="p-1 -ml-1 text-slate-500 hover:text-rose-400 transition"
                    title={`Delete Question ${idx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Final Screen Chip */}
          <button
            onClick={jumpToFinalScreen}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition shrink-0 flex items-center gap-1"
            title="Jump to Final Score & Trophy Screen"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Final Screen</span>
          </button>

          {/* DIRECT ADD QUESTION BUTTON (IN FRONT OF CANVAS) */}
          <button
            onClick={handleAddQuestion}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition shrink-0 flex items-center gap-1 shadow-sm"
            title="Add a new question to the quiz"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Question</span>
          </button>
        </div>

        {/* Phase Jump Chips for Active Question */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] text-slate-400 font-semibold">Q{activeQuestionIndex + 1} Phases:</span>
          <button
            onClick={() => jumpToQuestion(activeQuestionIndex, 'reading')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-semibold flex items-center gap-1"
          >
            <span>🎙️ 1. Question Reading</span>
          </button>
          <button
            onClick={() => jumpToQuestion(activeQuestionIndex, 'countdown')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold flex items-center gap-1"
          >
            <span>⏳ 2. Countdown Timer</span>
          </button>
          <button
            onClick={() => jumpToQuestion(activeQuestionIndex, 'reveal')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-semibold flex items-center gap-1"
          >
            <span>✅ 3. Reveal Answer</span>
          </button>
        </div>
      </div>

      {/* 2. CANVAS CONTAINER (Adaptive aspect ratio) */}
      <div className="flex-1 flex items-center justify-center p-1 sm:p-2 bg-slate-950/60 rounded-xl overflow-hidden min-h-[360px] sm:min-h-[440px] max-h-[580px] sm:max-h-[640px]">
        <div
          className={`relative max-w-full max-h-full flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-slate-800 ${
            isPortrait ? 'aspect-[9/16] h-full' : 'aspect-[16/9] w-full'
          }`}
        >
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full object-contain block select-none"
          />
        </div>
      </div>

      {/* 3. TIMELINE & PLAYER CONTROLS */}
      <div className="pt-3 sm:pt-4 space-y-2.5">
        {/* Timeline Slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 min-w-[50px]">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-xs font-mono text-slate-500 min-w-[50px] text-right">
            {formatTime(totalDuration)}
          </span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className={`p-2 sm:px-4 sm:py-2 rounded-xl font-bold flex items-center gap-2 transition shadow-md active:scale-95 ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Play Full Video</span>
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition"
              title="Reset Video to Start"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Auto Narrate Toggle in Preview */}
            <label
              className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold cursor-pointer pl-1"
              title="Speak voice narration automatically during playback"
            >
              <input
                type="checkbox"
                checked={autoNarrateInPreview}
                onChange={(e) => setAutoNarrateInPreview(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-500 rounded"
              />
              <span className="hidden sm:inline">Auto-Voiceover on Play</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              <option value={0.5}>0.5x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2.0}>2.0x</option>
            </select>

            <button
              onClick={() => setShowQuickEditor(!showQuickEditor)}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition ${
                showQuickEditor
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{showQuickEditor ? 'Hide Quick Edit' : 'Quick Edit'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. INLINE QUICK QUESTION EDITOR (Directly below canvas controls) */}
      {showQuickEditor && activeQuestion && (
        <div className="mt-4 pt-4 border-t border-slate-800/90 space-y-3 bg-slate-950/40 p-3 sm:p-4 rounded-xl border border-slate-800 animate-in fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                {activeQuestionIndex + 1}
              </span>
              <span className="font-bold text-white text-xs sm:text-sm">
                Edit Question {activeQuestionIndex + 1} of {quiz.questions.length}
              </span>
              {isMalayalam && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Malayalam (മലയാളം)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addActiveStatement}
                className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1 transition"
                title="Add multiple numbered statements (UPSC / Exam style)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{hasStatements ? '+ Add Statement' : '+ Convert to Statement Question'}</span>
              </button>
            </div>
          </div>

          {/* Question Prompt */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
              {hasStatements ? 'Introductory Statement / Question Setup:' : 'Question Prompt (Multi-line supported):'}
            </label>
            <textarea
              value={activeQuestion.question}
              onChange={(e) => updateActiveQuestion({ question: e.target.value })}
              rows={2}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed"
              placeholder="Type your question..."
            />
          </div>

          {/* Statements List if present */}
          {hasStatements && (
            <div className="bg-slate-900/60 border border-sky-500/20 rounded-xl p-3 space-y-2">
              <span className="text-[11px] font-bold text-sky-400 block">Numbered Statements:</span>
              <div className="space-y-1.5">
                {activeQuestion.statements?.map((st, sIdx) => (
                  <div key={sIdx} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 text-sky-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                      {sIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={st}
                      onChange={(e) => updateActiveStatement(sIdx, e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                      placeholder={`Statement ${sIdx + 1}...`}
                    />
                    <button
                      type="button"
                      onClick={() => removeActiveStatement(sIdx)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      title="Delete Statement"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Question Footer */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                  Closing Prompt (e.g. Which of the statements given above is/are correct?):
                </label>
                <input
                  type="text"
                  value={activeQuestion.questionFooter || ''}
                  onChange={(e) => updateActiveQuestion({ questionFooter: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-sky-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {/* 4 Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeQuestion.options.map((opt, oIdx) => {
              const isCorrect = oIdx === activeQuestion.correctIndex;
              const letters = ['A', 'B', 'C', 'D'];
              return (
                <div
                  key={oIdx}
                  className={`flex items-center gap-2 p-1.5 px-2.5 rounded-xl border transition ${
                    isCorrect
                      ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateActiveQuestion({ correctIndex: oIdx })}
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition ${
                      isCorrect
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/40 ring-2 ring-emerald-400'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title={isCorrect ? 'Correct Option' : `Click to set Option ${letters[oIdx]} as correct`}
                  >
                    {letters[oIdx]}
                  </button>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateActiveOption(oIdx, e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs text-white focus:outline-none font-medium"
                    placeholder={`Option ${letters[oIdx]}...`}
                  />
                  {isCorrect && (
                    <span className="text-[10px] font-bold text-emerald-400">CORRECT</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation / Solution Editor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                Explanation Header Label:
              </label>
              <select
                value={activeQuestion.explanationLabel || 'Solution'}
                onChange={(e) => updateActiveQuestion({ explanationLabel: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Solution">Solution (Maths/Reasoning)</option>
                <option value="Explanation">Explanation (General)</option>
                <option value="Fact">Fact (Trivia)</option>
                <option value="വിശദീകരണം">വിശദീകരണം (Malayalam)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                {activeQuestion.explanationLabel || 'Solution'} Content:
              </label>
              <textarea
                value={activeQuestion.explanation || ''}
                onChange={(e) => updateActiveQuestion({ explanation: e.target.value })}
                rows={1}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1 text-xs text-emerald-200 focus:outline-none focus:border-emerald-500 leading-snug"
                placeholder="Type step-by-step math solution or explanation..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
