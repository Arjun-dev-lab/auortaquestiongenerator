import React, { useState } from 'react';
import { ExportProgress, QuizConfig, QuizQuestion } from './types/quiz';
import { VideoPreview } from './components/VideoPreview';
import { QuizEditor } from './components/QuizEditor';
import { ExportModal } from './components/ExportModal';
import { exportQuizToMp4, ExportResult } from './utils/mp4Exporter';
import {
  Download,
  ShieldCheck,
  CheckCircle2,
  Film,
  PlusCircle,
  Layout,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

const DEFAULT_QUIZ: QuizConfig = {
  title: 'Exam Trivia & GK Challenge',
  theme: 'neon-cyber',
  aspectRatio: '9:16',
  countdownDuration: 3.0,
  revealDuration: 2.0,
  finalScreenDuration: 3.5,
  enableBgm: true,
  bgmVolume: 0.35,
  enableSfx: true,
  sfxVolume: 0.8,
  fps: 30,
  questions: [
    {
      id: 'q1',
      question: 'Which planet in our solar system has the highest number of moons?',
      options: ['Mars', 'Jupiter', 'Saturn', 'Neptune'],
      correctIndex: 2, // C: Saturn
      explanation: 'Saturn has 146 confirmed moons, the most in our solar system!',
      category: 'Astronomy',
    },
    {
      id: 'q2',
      question: 'What is the hardest naturally occurring substance found on Earth?',
      options: ['Titanium', 'Diamond', 'Graphene', 'Quartz'],
      correctIndex: 1, // B: Diamond
      explanation: 'Diamond is pure carbon crystallized in an isometric-octahedral lattice.',
      category: 'Science',
    },
    {
      id: 'q3',
      question: 'Which is the longest river in the world by total length?',
      options: ['Nile River', 'Amazon River', 'Yangtze River', 'Mississippi River'],
      correctIndex: 0, // A: Nile River
      explanation: 'The Nile stretches approximately 6,650 km through northeastern Africa.',
      category: 'Geography',
    },
    {
      id: 'q4',
      question: 'Who is recognized as the Chief Architect of the Constitution of India?',
      options: ['Mahatma Gandhi', 'Jawaharlal Nehru', 'Sardar Patel', 'Dr. B. R. Ambedkar'],
      correctIndex: 3, // D: Dr. B. R. Ambedkar
      explanation: 'Dr. B. R. Ambedkar was the Chairman of the Drafting Committee.',
      category: 'Polity',
    },
  ],
  promo: {
    enabled: true,
    appName: 'Auorta Learning App',
    headline: 'Download Auorta Learning App',
    description: 'Practice Full-Length Mock Tests & Solved Previous Year Questions. Available on Google Play!',
    ctaText: 'GET IT ON Google Play',
    tickerText: 'Download Auorta Learning App on Google Play for Mock Tests & Previous Year Questions',
    showTicker: true,
    showInFinalScreen: true,
  },
};

export default function App() {
  const [quiz, setQuiz] = useState<QuizConfig>(DEFAULT_QUIZ);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'split' | 'preview' | 'questions'>('split');
  const [isExporting, setIsExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    stage: 'idle',
    currentFrame: 0,
    totalFrames: 0,
    percent: 0,
    message: '',
  });

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportModalOpen(true);
    setExportResult(null);
    setExportProgress({
      stage: 'audio',
      currentFrame: 0,
      totalFrames: 1,
      percent: 0,
      message: 'Initializing offline MP4 export...',
    });

    try {
      const res = await exportQuizToMp4({
        quiz,
        onProgress: (prog) => {
          setExportProgress(prog);
        },
      });
      setExportResult(res);
      setIsExporting(false);
    } catch (err: any) {
      console.error('Export failed:', err);
      setIsExporting(false);
      setExportProgress({
        stage: 'error',
        currentFrame: 0,
        totalFrames: 0,
        percent: 0,
        message: 'Failed to complete export',
        error: err.message || 'Unknown encoding error',
      });
    }
  };

  const handleResetDefaults = () => {
    setQuiz(DEFAULT_QUIZ);
    setActiveQuestionIndex(0);
  };

  const handleAddQuestionHeader = () => {
    const newIndex = quiz.questions.length;
    const defaultCorrect = newIndex % 4; // Cycle correct answer A, B, C, D
    const newQ: QuizQuestion = {
      id: `q_${Date.now()}`,
      question: `New Question #${newIndex + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: defaultCorrect,
      explanation: 'Explanation for correct answer',
    };
    setQuiz({ ...quiz, questions: [...quiz.questions, newQ] });
    setActiveQuestionIndex(newIndex);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Film className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  QuizCraft MP4
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  YouTube Shorts & 16:9 Optimized
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Auorta Learning App Promotion • Zero CDN • Deterministic offline MP4 rendering
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Add Question Button in top header */}
            <button
              onClick={handleAddQuestionHeader}
              className="py-2 px-3 rounded-xl font-bold bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 text-xs transition"
              title="Add a new question"
            >
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">+ Add Question</span>
              <span className="sm:hidden">+ Question</span>
            </button>

            {/* Export MP4 button */}
            <button
              onClick={handleStartExport}
              disabled={isExporting}
              className="py-2.5 px-4 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 text-xs transition active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export MP4</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Verification banner with View Toggles for responsive layout */}
        <div className="mb-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-white block">
                {quiz.questions.length} Questions Loaded • Auorta Learning App Promo Active
              </span>
              <span className="text-slate-400">
                Shorts vertical safe zones & 16:9 broadcast 2x2 grid with Google Play download badge.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* View layout mode switch */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Side-by-side view"
              >
                <Layout className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Split</span>
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Canvas Focus"
              >
                <Film className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Canvas</span>
              </button>
              <button
                onClick={() => setViewMode('questions')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === 'questions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Questions & Settings"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Questions</span>
              </button>
            </div>

            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 font-mono text-[11px]">
              {quiz.aspectRatio === '9:16' ? '720x1280 (9:16 Shorts)' : '1280x720 (16:9 Normal)'}
            </span>
          </div>
        </div>

        {/* Dynamic Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Canvas Preview Column */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div className={viewMode === 'preview' ? 'lg:col-span-12 max-w-3xl mx-auto w-full' : 'lg:col-span-6 xl:col-span-6'}>
              <VideoPreview
                quiz={quiz}
                onUpdateQuiz={setQuiz}
                onExportClick={handleStartExport}
                isExporting={isExporting}
                activeQuestionIndex={activeQuestionIndex}
                setActiveQuestionIndex={setActiveQuestionIndex}
              />
            </div>
          )}

          {/* Quiz Configuration Column */}
          {(viewMode === 'split' || viewMode === 'questions') && (
            <div className={viewMode === 'questions' ? 'lg:col-span-12 max-w-4xl mx-auto w-full' : 'lg:col-span-6 xl:col-span-6'}>
              <QuizEditor
                quiz={quiz}
                onUpdateQuiz={setQuiz}
                onResetDefault={handleResetDefaults}
                activeQuestionIndex={activeQuestionIndex}
                setActiveQuestionIndex={setActiveQuestionIndex}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        <p>QuizCraft • 100% Offline Client-Side MP4 Generation • Auorta Learning App Campaign</p>
      </footer>

      {/* Export Modal */}
      {exportModalOpen && (
        <ExportModal
          progress={exportProgress}
          result={exportResult}
          isExporting={isExporting}
          onClose={() => setExportModalOpen(false)}
          onRetry={handleStartExport}
        />
      )}
    </div>
  );
}
