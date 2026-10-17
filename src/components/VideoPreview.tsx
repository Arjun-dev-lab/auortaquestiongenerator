import React, { useEffect, useRef, useState } from 'react';
import { QuizConfig, QuizQuestion } from '../types/quiz';
import { previewAudio } from '../utils/audioSynth';
import { renderQuizFrame } from '../utils/canvasRenderer';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Smartphone,
  Tv,
  PlusCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

interface Props {
  quiz: QuizConfig;
  onUpdateQuiz: (quiz: QuizConfig) => void;
  onExportClick: () => void;
  isExporting: boolean;
  activeQuestionIndex: number;
  setActiveQuestionIndex: (index: number) => void;
}

export const VideoPreview: React.FC<Props> = ({
  quiz,
  onUpdateQuiz,
  onExportClick,
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

  const isPortrait = quiz.aspectRatio === '9:16';
  const width = isPortrait ? 720 : 1280;
  const height = isPortrait ? 1280 : 720;

  const totalDuration =
    quiz.questions.length * (quiz.countdownDuration + quiz.revealDuration) + quiz.finalScreenDuration;

  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastSoundTriggerRef = useRef<{ [key: string]: boolean }>({});

  // Sync mute state with audio engine
  useEffect(() => {
    previewAudio.setMuted(isMuted);
  }, [isMuted]);

  // Main playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
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
          return totalDuration;
        }

        // Sound triggers during playback
        let tAcc = 0;
        quiz.questions.forEach((q, idx) => {
          const qDuration = quiz.countdownDuration + quiz.revealDuration;
          const qStart = tAcc;
          const revealTime = qStart + quiz.countdownDuration;

          // Tick sounds
          for (let s = 0; s < Math.floor(quiz.countdownDuration); s++) {
            const tickT = qStart + s;
            const key = `tick_${idx}_${s}`;
            if (prev < tickT && next >= tickT && !lastSoundTriggerRef.current[key]) {
              lastSoundTriggerRef.current[key] = true;
              previewAudio.playTick();
            }
          }

          // Reveal sound
          const revealKey = `reveal_${idx}`;
          if (prev < revealTime && next >= revealTime && !lastSoundTriggerRef.current[revealKey]) {
            lastSoundTriggerRef.current[revealKey] = true;
            previewAudio.playReveal();
          }

          tAcc += qDuration;
        });

        // Final screen fanfare
        const finalKey = 'final_fanfare';
        if (prev < tAcc && next >= tAcc && !lastSoundTriggerRef.current[finalKey]) {
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
  }, [isPlaying, playbackSpeed, totalDuration, quiz]);

  // Track active question based on currentTime
  useEffect(() => {
    const qDuration = quiz.countdownDuration + quiz.revealDuration;
    const computedIndex = Math.floor(currentTime / qDuration);
    if (computedIndex >= 0 && computedIndex < quiz.questions.length) {
      setActiveQuestionIndex(computedIndex);
    }
  }, [currentTime, quiz.countdownDuration, quiz.revealDuration, quiz.questions.length, setActiveQuestionIndex]);

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
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    lastSoundTriggerRef.current = {};
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    lastSoundTriggerRef.current = {};
  };

  const toggleAspectRatio = () => {
    onUpdateQuiz({
      ...quiz,
      aspectRatio: isPortrait ? '16:9' : '9:16',
    });
  };

  // Jump canvas to specific question start
  const jumpToQuestion = (qIndex: number, phase: 'countdown' | 'reveal' = 'countdown') => {
    setIsPlaying(false);
    setActiveQuestionIndex(qIndex);
    const qDuration = quiz.countdownDuration + quiz.revealDuration;
    const offset = phase === 'countdown' ? 0.05 : quiz.countdownDuration + 0.05;
    const targetTime = Math.min(totalDuration, qIndex * qDuration + offset);
    setCurrentTime(targetTime);
    lastSoundTriggerRef.current = {};
  };

  // Jump canvas to final screen
  const jumpToFinalScreen = () => {
    setIsPlaying(false);
    const qDuration = quiz.countdownDuration + quiz.revealDuration;
    const finalStart = quiz.questions.length * qDuration + 0.1;
    setCurrentTime(Math.min(totalDuration, finalStart));
    lastSoundTriggerRef.current = {};
  };

  // Add a new question right in front of the canvas
  const handleAddQuestion = () => {
    const newIndex = quiz.questions.length;
    const newQ: QuizQuestion = {
      id: `q_${Date.now()}`,
      question: `New Trivia Question #${newIndex + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      explanation: 'Explanation for correct answer',
    };
    const nextQuestions = [...quiz.questions, newQ];
    onUpdateQuiz({ ...quiz, questions: nextQuestions });
    setActiveQuestionIndex(newIndex);
    // Jump preview to new question
    const qDuration = quiz.countdownDuration + quiz.revealDuration;
    setCurrentTime(newIndex * qDuration);
  };

  // Remove the active question right in front of the canvas
  const handleRemoveQuestion = (indexToRemove: number) => {
    if (quiz.questions.length <= 1) return;
    const nextQuestions = quiz.questions.filter((_, i) => i !== indexToRemove);
    onUpdateQuiz({ ...quiz, questions: nextQuestions });
    const nextActive = Math.max(0, Math.min(indexToRemove, nextQuestions.length - 1));
    setActiveQuestionIndex(nextActive);
    const qDuration = quiz.countdownDuration + quiz.revealDuration;
    setCurrentTime(nextActive * qDuration);
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

  const formatTime = (secs: number) => {
    const s = Math.floor(secs);
    const ms = Math.floor((secs % 1) * 10);
    return `${s.toString().padStart(2, '0')}.${ms}s`;
  };

  const activeQuestion = quiz.questions[activeQuestionIndex] || quiz.questions[0];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 lg:p-6 flex flex-col shadow-xl">
      {/* 1. TOP HEADER & QUESTION NAVIGATION BAR (Directly above canvas) */}
      <div className="pb-3 mb-3 border-b border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-sm">Video Preview</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
              {width}x{height}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Aspect Ratio Switch */}
            <button
              onClick={toggleAspectRatio}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              title="Switch Aspect Ratio"
            >
              {isPortrait ? (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                  <span>9:16 Vertical</span>
                </>
              ) : (
                <>
                  <Tv className="w-3.5 h-3.5 text-sky-400" />
                  <span>16:9 Horizontal</span>
                </>
              )}
            </button>

            {/* Export MP4 button */}
            <button
              onClick={onExportClick}
              disabled={isExporting}
              className="py-1.5 px-3 rounded-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 text-xs transition active:scale-95 disabled:opacity-50"
            >
              Export MP4
            </button>
          </div>
        </div>

        {/* Question Selector Chips & Add Question Button */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Scenes:
          </span>

          {quiz.questions.map((q, idx) => {
            const isActive = idx === activeQuestionIndex;
            return (
              <div key={q.id || idx} className="flex items-center shrink-0">
                <button
                  onClick={() => jumpToQuestion(idx, 'countdown')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title={`Jump to Question ${idx + 1}`}
                >
                  <span>Q{idx + 1}</span>
                  <span className="max-w-[100px] truncate opacity-80 hidden sm:inline">
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
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Add Question</span>
          </button>
        </div>
      </div>

      {/* 2. CANVAS CONTAINER */}
      <div className="flex-1 flex items-center justify-center bg-slate-950/70 rounded-xl overflow-hidden p-2 min-h-[360px] lg:min-h-[440px] relative group">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="rounded-lg shadow-2xl transition-all duration-300 max-h-[460px] w-auto object-contain border border-slate-800"
          style={{
            aspectRatio: isPortrait ? '9/16' : '16/9',
          }}
        />

        {/* Quick jump phase buttons overlay at top right of canvas */}
        <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-950/80 backdrop-blur-md p-1 rounded-xl border border-slate-800 text-[11px] opacity-90 group-hover:opacity-100 transition">
          <button
            onClick={() => jumpToQuestion(activeQuestionIndex, 'countdown')}
            className="px-2 py-1 rounded-lg text-sky-400 hover:bg-slate-800 font-semibold flex items-center gap-1"
            title="Jump to countdown phase"
          >
            <Clock className="w-3 h-3" />
            <span>Countdown</span>
          </button>
          <button
            onClick={() => jumpToQuestion(activeQuestionIndex, 'reveal')}
            className="px-2 py-1 rounded-lg text-emerald-400 hover:bg-slate-800 font-semibold flex items-center gap-1"
            title="Jump to reveal answer phase"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Reveal</span>
          </button>
        </div>
      </div>

      {/* 3. PLAYBACK TIMELINE & CONTROLS */}
      <div className="mt-3 space-y-2.5">
        {/* Timeline Slider */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-400 w-12 text-right">
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
          <span className="font-mono text-xs text-slate-500 w-12">
            {formatTime(totalDuration)}
          </span>
        </div>

        {/* Buttons Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePlayPause}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition active:scale-95"
              title={isPlaying ? 'Pause' : 'Play Preview'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={handleReset}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Reset to Start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Quick Editor toggle button */}
            <button
              onClick={() => setShowQuickEditor(!showQuickEditor)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                showQuickEditor
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Quick Edit</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed Selector */}
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value={0.5}>0.5x Speed</option>
              <option value={1.0}>1.0x Speed</option>
              <option value={1.5}>1.5x Speed</option>
              <option value={2.0}>2.0x Speed</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. INLINE QUICK QUESTION EDITOR (DIRECTLY IN FRONT OF CANVAS) */}
      {showQuickEditor && activeQuestion && (
        <div className="mt-3 bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Editing Question {activeQuestionIndex + 1} of {quiz.questions.length}
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                (Click radio button to mark correct answer)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAddQuestion}
                className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 border border-emerald-500/30 transition"
              >
                <PlusCircle className="w-3 h-3" />
                <span>+ Add</span>
              </button>

              {quiz.questions.length > 1 && (
                <button
                  onClick={() => handleRemoveQuestion(activeQuestionIndex)}
                  className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold flex items-center gap-1 border border-rose-500/30 transition"
                  title="Remove this question"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>

          {/* Question Input */}
          <input
            type="text"
            value={activeQuestion.question}
            onChange={(e) => updateActiveQuestion({ question: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
            placeholder="Type question prompt..."
          />

          {/* 4 Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeQuestion.options.map((optText, optIdx) => {
              const letters = ['A', 'B', 'C', 'D'];
              const isCorrect = optIdx === activeQuestion.correctIndex;

              return (
                <div
                  key={optIdx}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border transition text-xs ${
                    isCorrect
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateActiveQuestion({ correctIndex: optIdx })}
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 transition ${
                      isCorrect
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title={isCorrect ? 'Correct Answer' : 'Click to set as correct answer'}
                  >
                    {letters[optIdx]}
                  </button>
                  <input
                    type="text"
                    value={optText}
                    onChange={(e) => updateActiveOption(optIdx, e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs text-white focus:outline-none"
                    placeholder={`Option ${letters[optIdx]}...`}
                  />
                  {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
