import React, { useState, useEffect } from 'react';
import { QuizConfig, QuizQuestion, QuizTheme, PromoConfig, VoiceOverConfig } from '../types/quiz';
import { QUIZ_THEMES } from '../utils/themes';
import { previewAudio } from '../utils/audioSynth';
import { voiceOverService, VoiceOption } from '../utils/voiceOverService';
import {
  HelpCircle,
  Clock,
  Music,
  Palette,
  CheckCircle2,
  Trash2,
  PlusCircle,
  RotateCcw,
  Copy,
  ArrowUp,
  ArrowDown,
  Sparkles,
  FileCode,
  Layers,
  ListOrdered,
  Plus,
  Mic,
  Languages,
  Play,
  Square,
  Sliders,
} from 'lucide-react';

interface Props {
  quiz: QuizConfig;
  onUpdateQuiz: (quiz: QuizConfig) => void;
  onResetDefault: () => void;
  onOpenJsonModal: () => void;
  onOpenVoiceOverModal?: () => void;
  onLoadMalayalamSample?: () => void;
  activeQuestionIndex: number;
  setActiveQuestionIndex: (index: number) => void;
}

const PRESET_TITLE = 'Auorta Learning Quiz Challenge';

const SOLUTION_LABEL_PRESETS = [
  'Solution',
  'Step-by-Step Solution',
  'Maths Solution',
  'Key Fact',
  'Did You Know?',
  'Explanation',
  'വിശദീകരണം',
];

export const QuizEditor: React.FC<Props> = ({
  quiz,
  onUpdateQuiz,
  onResetDefault,
  onOpenJsonModal,
  onOpenVoiceOverModal,
  onLoadMalayalamSample,
  activeQuestionIndex,
  setActiveQuestionIndex,
}) => {
  const [activeTab, setActiveTab] = useState<'questions' | 'voiceover' | 'promo' | 'timings' | 'audio'>('questions');
  const [speakingQIndex, setSpeakingQIndex] = useState<number | null>(null);

  const voConfig: VoiceOverConfig = quiz.voiceOver || {
    enabled: true,
    language: 'auto',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    readQuestion: true,
    readStatements: true,
    readOptions: true,
    announceAnswerOnReveal: true,
    readExplanation: true,
  };

  const [availableVoices, setAvailableVoices] = useState<{
    malayalam: VoiceOption[];
    english: VoiceOption[];
    other: VoiceOption[];
  }>({ malayalam: [], english: [], other: [] });

  useEffect(() => {
    setAvailableVoices(voiceOverService.getCategorizedVoices());
    const unsub = voiceOverService.subscribeState((speaking) => {
      if (!speaking) {
        setSpeakingQIndex((prev) => (prev !== null ? null : prev));
      }
    });
    return () => {
      unsub();
    };
  }, []);

  const updateQuestion = (index: number, updated: Partial<QuizQuestion>) => {
    const nextQuestions = [...quiz.questions];
    nextQuestions[index] = { ...nextQuestions[index], ...updated };
    onUpdateQuiz({ ...quiz, questions: nextQuestions });
  };

  const updateOptionText = (qIndex: number, optIndex: number, text: string) => {
    const nextQuestions = [...quiz.questions];
    const q = nextQuestions[qIndex];
    const nextOptions = [...q.options] as [string, string, string, string];
    nextOptions[optIndex] = text;
    nextQuestions[qIndex] = { ...q, options: nextOptions };
    onUpdateQuiz({ ...quiz, questions: nextQuestions });
  };

  const addQuestion = () => {
    const newIndex = quiz.questions.length;
    const defaultCorrect = newIndex % 4;
    const newQ: QuizQuestion = {
      id: `q_${Date.now()}`,
      question: `New Question #${newIndex + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: defaultCorrect,
      explanationLabel: 'Solution',
      explanation: 'Step-by-step solution for the correct answer.',
    };
    onUpdateQuiz({ ...quiz, questions: [...quiz.questions, newQ] });
    setActiveQuestionIndex(newIndex);
  };

  const duplicateQuestion = (index: number) => {
    const source = quiz.questions[index];
    const cloned: QuizQuestion = {
      ...source,
      id: `q_${Date.now()}`,
      question: `${source.question} (Copy)`,
      statements: source.statements ? [...source.statements] : undefined,
      options: [...source.options] as [string, string, string, string],
    };
    const nextQuestions = [...quiz.questions];
    nextQuestions.splice(index + 1, 0, cloned);
    onUpdateQuiz({ ...quiz, questions: nextQuestions });
    setActiveQuestionIndex(index + 1);
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= quiz.questions.length) return;
    const nextQuestions = [...quiz.questions];
    const [moved] = nextQuestions.splice(fromIndex, 1);
    nextQuestions.splice(toIndex, 0, moved);
    onUpdateQuiz({ ...quiz, questions: nextQuestions });
    setActiveQuestionIndex(toIndex);
  };

  const removeQuestion = (index: number) => {
    if (quiz.questions.length <= 1) return;
    const nextQuestions = quiz.questions.filter((_, i) => i !== index);
    onUpdateQuiz({ ...quiz, questions: nextQuestions });
    setActiveQuestionIndex(Math.max(0, Math.min(index, nextQuestions.length - 1)));
  };

  // Statement management helpers
  const addStatement = (qIndex: number) => {
    const q = quiz.questions[qIndex];
    const stmts = q.statements ? [...q.statements] : [];
    stmts.push(`${stmts.length + 1}. New Statement`);
    updateQuestion(qIndex, {
      statements: stmts,
      questionFooter: q.questionFooter || 'Which of the statements given above is/are correct?',
    });
  };

  const updateStatement = (qIndex: number, stmtIndex: number, text: string) => {
    const q = quiz.questions[qIndex];
    if (!q.statements) return;
    const stmts = [...q.statements];
    stmts[stmtIndex] = text;
    updateQuestion(qIndex, { statements: stmts });
  };

  const removeStatement = (qIndex: number, stmtIndex: number) => {
    const q = quiz.questions[qIndex];
    if (!q.statements) return;
    const stmts = q.statements.filter((_, i) => i !== stmtIndex);
    updateQuestion(qIndex, {
      statements: stmts.length > 0 ? stmts : undefined,
      questionFooter: stmts.length > 0 ? q.questionFooter : undefined,
    });
  };

  const updatePromo = (updated: Partial<PromoConfig>) => {
    const currentPromo: PromoConfig = quiz.promo || {
      enabled: true,
      appName: 'Auorta Learning App',
      headline: 'Boost Your Exam Preparation with Auorta',
      description: 'Access Full-Length Mock Tests & Solved Previous Year Questions (PYQs)',
      ctaText: 'GET IT ON Google Play',
      tickerText: 'Download Auorta Learning App on Google Play for Mock Tests & PYQs',
      showTicker: true,
      showInFinalScreen: true,
    };
    onUpdateQuiz({ ...quiz, promo: { ...currentPromo, ...updated } });
  };

  const updateVoiceOver = (updated: Partial<VoiceOverConfig>) => {
    onUpdateQuiz({ ...quiz, voiceOver: { ...voConfig, ...updated } });
  };

  // Instant voice check for a specific question with strict sequenced timing
  const handleCheckQuestionVoice = (qIndex: number) => {
    if (speakingQIndex === qIndex) {
      voiceOverService.stop();
      setSpeakingQIndex(null);
      return;
    }

    const q = quiz.questions[qIndex];
    if (!q) return;

    setSpeakingQIndex(qIndex);
    voiceOverService.checkQuestionVoiceOver(
      q,
      voConfig,
      quiz.countdownDuration || 4.0,
      (phase) => {
        if (phase === 'done') {
          setSpeakingQIndex(null);
        }
      },
      () => {
        previewAudio.playTick();
      }
    );
  };

  const currentPromo = quiz.promo || {
    enabled: true,
    appName: 'Auorta Learning App',
    headline: 'Boost Your Exam Preparation with Auorta',
    description: 'Access Full-Length Mock Tests & Solved Previous Year Questions (PYQs)',
    ctaText: 'GET IT ON Google Play',
    tickerText: 'Download Auorta Learning App on Google Play for Mock Tests & PYQs',
    showTicker: true,
    showInFinalScreen: true,
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-5 lg:p-6 space-y-4 shadow-xl">
      {/* Header with Title, JSON Import button, and Reset Defaults */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              Quiz Video Settings
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
              Auorta Preset
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Edit questions, Malayalam & English natural voice-overs, statements, and options
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Voice-Over Quick Button */}
          {onOpenVoiceOverModal && (
            <button
              onClick={onOpenVoiceOverModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition shadow-sm"
              title="Check Voice-Over in Malayalam or English"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice-Over</span>
            </button>
          )}

          {/* Paste / Import JSON Button */}
          <button
            onClick={onOpenJsonModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition shadow-sm"
            title="Import questions from JSON or paste JSON text"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>

          <button
            onClick={onResetDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            title="Reset to default quiz"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'questions'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Questions ({quiz.questions.length})</span>
        </button>

        {/* Dedicated Voice-Over Tab */}
        <button
          onClick={() => setActiveTab('voiceover')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'voiceover'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
              : 'bg-slate-800/80 text-sky-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Mic className="w-4 h-4 text-sky-400" />
          <span>Voice-Over (മലയാളം / EN)</span>
        </button>

        <button
          onClick={() => setActiveTab('promo')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'promo'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-slate-800/80 text-emerald-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Auorta Promo</span>
        </button>

        <button
          onClick={() => setActiveTab('timings')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'timings'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Timings & Theme</span>
        </button>

        <button
          onClick={() => setActiveTab('audio')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'audio'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Audio Mix</span>
        </button>
      </div>

      {/* TAB 1: QUESTIONS LIST */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {/* Top Bar with Add Question button and quick jump chips */}
          <div className="flex items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs text-slate-400 font-semibold shrink-0 mr-1">Select:</span>
              {quiz.questions.map((q, i) => {
                const letters = ['A', 'B', 'C', 'D'];
                const hasMl = voiceOverService.isMalayalamText(q.question);
                return (
                  <button
                    key={i}
                    onClick={() => setActiveQuestionIndex(i)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                      i === activeQuestionIndex
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>Q{i + 1}</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
                      {letters[q.correctIndex]}
                    </span>
                    {hasMl && (
                      <span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-400">
                        മല
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={addQuestion}
                className="py-2 px-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/25 text-xs transition shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add Question</span>
              </button>
            </div>
          </div>

          {/* Questions Cards */}
          <div className="space-y-4">
            {quiz.questions.map((question, qIdx) => {
              const isSelected = qIdx === activeQuestionIndex;
              const letters = ['A', 'B', 'C', 'D'];
              const hasStatements = Boolean(question.statements && question.statements.length > 0);
              const isSpeakingThis = speakingQIndex === qIdx;
              const isMl = voiceOverService.isMalayalamText(question.question);

              return (
                <div
                  key={question.id || qIdx}
                  onClick={() => setActiveQuestionIndex(qIdx)}
                  className={`bg-slate-950/80 border rounded-xl p-3.5 sm:p-4 space-y-3.5 transition cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-xs px-2.5 py-1 rounded-md border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        Question {qIdx + 1}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Correct: Option {letters[question.correctIndex]}
                      </span>
                      {isMl && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          മലയാളം
                        </span>
                      )}
                      {hasStatements && (
                        <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 flex items-center gap-1">
                          <ListOrdered className="w-3 h-3" />
                          Statement Question ({question.statements?.length})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {/* Individual Question Voice-Over Check */}
                      <button
                        type="button"
                        onClick={() => handleCheckQuestionVoice(qIdx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                          isSpeakingThis
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30'
                        }`}
                        title="Audition voice-over for this question"
                      >
                        {isSpeakingThis ? (
                          <>
                            <Square className="w-3 h-3 fill-white" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3 h-3 text-sky-400" />
                            <span>Voice Check</span>
                          </>
                        )}
                      </button>

                      {/* Toggle Statement Button */}
                      <button
                        onClick={() => {
                          if (hasStatements) {
                            updateQuestion(qIdx, { statements: undefined, questionFooter: undefined });
                          } else {
                            addStatement(qIdx);
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                          hasStatements
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title={hasStatements ? 'Remove statements' : 'Add statements to this question'}
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                        <span>{hasStatements ? 'Statements On' : '+ Statements'}</span>
                      </button>

                      <button
                        onClick={() => moveQuestion(qIdx, qIdx - 1)}
                        disabled={qIdx === 0}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => moveQuestion(qIdx, qIdx + 1)}
                        disabled={qIdx === quiz.questions.length - 1}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => duplicateQuestion(qIdx)}
                        className="p-1.5 rounded text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 transition"
                        title="Duplicate Question"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {quiz.questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(qIdx)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Prompt (Multi-line Support) */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-400 block">
                        {hasStatements ? 'Introductory Statement / Question Setup:' : 'Question Prompt (Supports Multi-lines):'}
                      </label>
                      <span className="text-[10px] text-slate-500">
                        {hasStatements ? 'e.g. Consider the following statements:' : 'Press Enter for newline'}
                      </span>
                    </div>
                    <textarea
                      value={question.question}
                      onChange={(e) => updateQuestion(qIdx, { question: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white font-medium focus:outline-none focus:border-indigo-500 leading-snug"
                      placeholder={hasStatements ? 'Consider the following statements regarding...' : 'Type question prompt (multi-line supported)...'}
                    />
                  </div>

                  {/* Statements Editor Section if enabled */}
                  {hasStatements && (
                    <div
                      className="bg-slate-900/70 border border-sky-500/30 rounded-xl p-3 space-y-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Statements List:</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addStatement(qIdx)}
                          className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-semibold flex items-center gap-1 transition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Add Statement</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {question.statements?.map((stmt, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-800 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0">
                              {sIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={stmt}
                              onChange={(e) => updateStatement(qIdx, sIdx, e.target.value)}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                              placeholder={`Statement ${sIdx + 1}...`}
                            />
                            <button
                              type="button"
                              onClick={() => removeStatement(qIdx, sIdx)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition"
                              title="Delete this statement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Question Footer */}
                      <div className="pt-1 border-t border-slate-800/60">
                        <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                          Question Closing Prompt / Question Footer:
                        </label>
                        <input
                          type="text"
                          value={question.questionFooter || ''}
                          onChange={(e) => updateQuestion(qIdx, { questionFooter: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-sky-200 font-medium focus:outline-none focus:border-sky-500"
                          placeholder="e.g. Which of the statements given above is/are correct?"
                        />
                      </div>
                    </div>
                  )}

                  {/* 4 Options Grid with Radio Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    {question.options.map((optText, optIdx) => {
                      const isCorrect = optIdx === question.correctIndex;

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition ${
                            isCorrect
                              ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => updateQuestion(qIdx, { correctIndex: optIdx })}
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition ${
                              isCorrect
                                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                            title={isCorrect ? 'Correct Answer (Click to change)' : `Click to set Option ${letters[optIdx]} as correct`}
                          >
                            {letters[optIdx]}
                          </button>
                          <input
                            type="text"
                            value={optText}
                            onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                            className="flex-1 bg-transparent border-none text-xs text-white focus:outline-none"
                            placeholder={`Option ${letters[optIdx]}...`}
                          />
                          {isCorrect && (
                            <span className="text-[11px] font-bold text-emerald-400 shrink-0">CORRECT</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Category & Custom Solution / Fact Label */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                        Category Tag:
                      </label>
                      <input
                        type="text"
                        value={question.category || ''}
                        onChange={(e) => updateQuestion(qIdx, { category: e.target.value })}
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-600"
                        placeholder="e.g. Mathematics, Science, Polity..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-400 block">
                          Card Header / Label:
                        </label>
                        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                          {SOLUTION_LABEL_PRESETS.slice(0, 5).map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => updateQuestion(qIdx, { explanationLabel: preset })}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                                question.explanationLabel === preset
                                  ? 'bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={question.explanationLabel || ''}
                        onChange={(e) => updateQuestion(qIdx, { explanationLabel: e.target.value })}
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-sky-300 font-semibold focus:outline-none focus:border-slate-600"
                        placeholder="e.g. Solution, Step-by-Step Solution, Maths Solution, Key Fact..."
                      />
                    </div>
                  </div>

                  {/* Multi-line Solution / Fact Text Area */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-400 block">
                        {question.explanationLabel || 'Solution / Fact'} (Revealed with Answer):
                      </label>
                      <span className="text-[10px] text-slate-500">
                        Supports multi-line steps with Enter (\n)
                      </span>
                    </div>
                    <textarea
                      value={question.explanation || ''}
                      onChange={(e) => updateQuestion(qIdx, { explanation: e.target.value })}
                      rows={3}
                      className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                      placeholder="Step 1: Formula...\nStep 2: Substitute values...\nStep 3: Answer: Option B is correct."
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Add Question Button */}
          <button
            onClick={addQuestion}
            className="w-full py-3 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Another Question</span>
          </button>
        </div>
      )}

      {/* TAB 2: VOICE-OVER & NARRATION TAB */}
      {activeTab === 'voiceover' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-sky-950/40 via-indigo-950/40 to-slate-950/40 border border-sky-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Natural Voice-Over Narration</h3>
                  <p className="text-xs text-slate-400">
                    Reads Question, reads Options, then announces the Correct Answer & Solution
                  </p>
                </div>
              </div>

              {onLoadMalayalamSample && (
                <button
                  type="button"
                  onClick={onLoadMalayalamSample}
                  className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>Load Malayalam Quiz</span>
                </button>
              )}
            </div>

            {/* Language Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <label className="font-semibold text-slate-300 mb-1.5 block">
                  Language Preference:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => updateVoiceOver({ language: 'auto' })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs border text-center transition ${
                      voConfig.language === 'auto'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Auto-Detect
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVoiceOver({ language: 'en' })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs border text-center transition ${
                      voConfig.language === 'en'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVoiceOver({ language: 'ml' })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs border text-center transition ${
                      voConfig.language === 'ml'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    മലയാളം (ML)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Voice Model:</span>
                  <span className="text-[10px] text-emerald-400 font-bold">Natural Neural</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={voConfig.voiceURI || ''}
                    onChange={(e) => updateVoiceOver({ voiceURI: e.target.value || undefined })}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">(Recommended) Best Natural Neural Voice</option>
                    {availableVoices.malayalam.length > 0 && (
                      <optgroup label="Malayalam Voices (മലയാളം)">
                        {availableVoices.malayalam.map((v) => (
                          <option key={v.voice.voiceURI} value={v.voice.voiceURI}>
                            {v.name} ({v.lang}) {v.isNatural ? '⭐ [Natural]' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="English Natural Voices">
                      {availableVoices.english.map((v) => (
                        <option key={v.voice.voiceURI} value={v.voice.voiceURI}>
                          {v.name} ({v.lang}) {v.isNatural ? '⭐ [Natural]' : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const sampleText = quiz.questions[activeQuestionIndex]?.question || 'Quiz test';
                      const v = voiceOverService.getBestVoice(voConfig.language, sampleText, voConfig.voiceURI);
                      if (v) {
                        voiceOverService.testSingleVoice(v, voConfig.language === 'ml' || voiceOverService.isMalayalamText(sampleText));
                      }
                    }}
                    className="px-2.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 flex items-center gap-1 shadow-sm"
                    title="Audition selected voice"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>▶ Test</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1 font-semibold">
                  <span>Speech Cadence (Speed):</span>
                  <span className="font-mono text-sky-400">{voConfig.rate}x</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.3}
                  step={0.05}
                  value={voConfig.rate}
                  onChange={(e) => updateVoiceOver({ rate: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1 font-semibold">
                  <span>Voice Pitch:</span>
                  <span className="font-mono text-emerald-400">{voConfig.pitch}</span>
                </div>
                <input
                  type="range"
                  min={0.85}
                  max={1.2}
                  step={0.05}
                  value={voConfig.pitch}
                  onChange={(e) => updateVoiceOver({ pitch: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            {/* Audition Bar for Selected Question */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">
                  Audition Question {activeQuestionIndex + 1}:
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                  {quiz.questions[activeQuestionIndex]?.question}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCheckQuestionVoice(activeQuestionIndex)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                    speakingQIndex === activeQuestionIndex
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {speakingQIndex === activeQuestionIndex ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>▶ Test Voice-Over</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUORTA LEARNING APP PROMOTION */}
      {activeTab === 'promo' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-sky-950/40 via-indigo-950/40 to-slate-950/40 border border-sky-500/30 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-black text-xl">
                  A
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Auorta Learning App Branding</h3>
                  <p className="text-xs text-slate-400">
                    Educational promotion for mock tests & previous year questions
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="text-xs font-semibold text-slate-300">Enable Promo</span>
                <input
                  type="checkbox"
                  checked={currentPromo.enabled}
                  onChange={(e) => updatePromo({ enabled: e.target.checked })}
                  className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Promo Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300 mb-1 block">App Name:</label>
                <input
                  type="text"
                  value={currentPromo.appName}
                  onChange={(e) => updatePromo({ appName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-sky-500"
                  placeholder="Auorta Learning App"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 mb-1 block">Action Headline:</label>
                <input
                  type="text"
                  value={currentPromo.headline}
                  onChange={(e) => updatePromo({ headline: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-sky-500"
                  placeholder="Boost Your Exam Score with Auorta"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-300 mb-1 block">
                  Value Proposition & Features:
                </label>
                <input
                  type="text"
                  value={currentPromo.description}
                  onChange={(e) => updatePromo({ description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-sky-500"
                  placeholder="Access Full-Length Mock Tests & Solved Previous Year Questions (PYQs)"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-300 mb-1 block">
                  Running Ticker Text (Shown at bottom during questions):
                </label>
                <input
                  type="text"
                  value={currentPromo.tickerText}
                  onChange={(e) => updatePromo({ tickerText: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-sky-500"
                  placeholder="Download Auorta Learning App on Google Play for Mock Tests & PYQs"
                />
              </div>
            </div>

            {/* Display Placement Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <label className="flex items-center gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentPromo.showTicker}
                  onChange={(e) => updatePromo({ showTicker: e.target.checked })}
                  className="w-4 h-4 accent-sky-500 rounded"
                />
                <div>
                  <span className="font-semibold text-white block">Bottom Ticker Pill</span>
                  <span className="text-[11px] text-slate-400">Shows under questions during quiz</span>
                </div>
              </label>

              <label className="flex items-center gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentPromo.showInFinalScreen}
                  onChange={(e) => updatePromo({ showInFinalScreen: e.target.checked })}
                  className="w-4 h-4 accent-sky-500 rounded"
                />
                <div>
                  <span className="font-semibold text-white block">Final Screen Spotlight Card</span>
                  <span className="text-[11px] text-slate-400">Shows Google Play badge with features</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TIMINGS & THEME */}
      {activeTab === 'timings' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Video Title / Header
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateQuiz({ ...quiz, title: PRESET_TITLE })}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline"
                >
                  Use Auorta Preset
                </button>
              </div>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => onUpdateQuiz({ ...quiz, title: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder={PRESET_TITLE}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
                Visual Theme
              </label>
              <select
                value={quiz.theme}
                onChange={(e) => onUpdateQuiz({ ...quiz, theme: e.target.value as QuizTheme })}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {Object.values(QUIZ_THEMES).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timings Sliders */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Clock className="w-4 h-4 text-sky-400" />
              Scene Durations
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Countdown</span>
                  <span className="font-mono font-bold text-sky-400">{quiz.countdownDuration}s</span>
                </div>
                <input
                  type="range"
                  min={1.5}
                  max={8.0}
                  step={0.5}
                  value={quiz.countdownDuration}
                  onChange={(e) => onUpdateQuiz({ ...quiz, countdownDuration: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Answer Reveal</span>
                  <span className="font-mono font-bold text-emerald-400">{quiz.revealDuration}s</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={6.0}
                  step={0.5}
                  value={quiz.revealDuration}
                  onChange={(e) => onUpdateQuiz({ ...quiz, revealDuration: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Final Screen</span>
                  <span className="font-mono font-bold text-amber-400">{quiz.finalScreenDuration}s</span>
                </div>
                <input
                  type="range"
                  min={1.5}
                  max={6.0}
                  step={0.5}
                  value={quiz.finalScreenDuration}
                  onChange={(e) => onUpdateQuiz({ ...quiz, finalScreenDuration: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIO SOUND FX & MUSIC */}
      {activeTab === 'audio' && (
        <div className="space-y-4">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-emerald-400" />
                Procedural Sound Engine
              </div>
              <span className="text-[11px] text-emerald-400 font-normal">
                100% Offline • Zero CDN
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 block">Sound Effects</span>
                    <span className="text-[11px] text-slate-400">Ticks, riser sweep, chime</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={quiz.enableSfx}
                    onChange={(e) => onUpdateQuiz({ ...quiz, enableSfx: e.target.checked })}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 block">Background Music</span>
                    <span className="text-[11px] text-slate-400">Procedural lo-fi chords</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={quiz.enableBgm}
                    onChange={(e) => onUpdateQuiz({ ...quiz, enableBgm: e.target.checked })}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
