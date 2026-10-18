import React, { useState } from 'react';
import { ExportProgress, QuizConfig, QuizQuestion, VoiceOverConfig } from './types/quiz';
import { VideoPreview } from './components/VideoPreview';
import { QuizEditor } from './components/QuizEditor';
import { ExportModal } from './components/ExportModal';
import { JsonImportModal } from './components/JsonImportModal';
import { VoiceOverModal } from './components/VoiceOverModal';
import { exportQuizToMp4, ExportResult } from './utils/mp4Exporter';
import {
  Download,
  ShieldCheck,
  Film,
  PlusCircle,
  Layout,
  HelpCircle,
  Sparkles,
  FileCode,
  Mic,
} from 'lucide-react';

export const MALAYALAM_SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'ml_q1',
    question: 'സൗരയൂഥത്തിൽ ഏറ്റവും കൂടുതൽ ഉപഗ്രഹങ്ങളുള്ള ഗ്രഹം ഏതാണ്?',
    statements: [
      '1. ശനിക്ക് നിലവിൽ 146 സ്ഥിരീകരിച്ച ഉപഗ്രഹങ്ങളുണ്ട്.',
      '2. സൗരയൂഥത്തിലെ ഏറ്റവും വലിയ ഗ്രഹമാണ് വ്യാഴം.'
    ],
    questionFooter: 'മുകളിൽ നൽകിയിട്ടുള്ള പ്രസ്താവനകളിൽ ശരിയായത് ഏതാണ്?',
    options: ['1 മാത്രം', '2 മാത്രം', '1 ഉം 2 ഉം ശരിയാണ്', 'രണ്ടും തെറ്റാണ്'],
    correctIndex: 2, // C: 1 ഉം 2 ഉം ശരിയാണ്
    explanationLabel: 'വിശദീകരണം',
    explanation: 'രണ്ട് പ്രസ്താവനകളും ശരിയാണ്! ശനിക്ക് നിലവിൽ 146 സ്ഥിരീകരിച്ച ഉപഗ്രഹങ്ങളുണ്ട്. വ്യാഴം സൗരയൂഥത്തിലെ ഏറ്റവും വലിയ ഗ്രഹമാണ്.',
    category: 'ശാസ്ത്രം & ജ്യോതിശാസ്ത്രം',
  },
  {
    id: 'ml_q2',
    question: 'ഇന്ത്യൻ ഭരണഘടനയുടെ മുഖ്യ ശില്പി എന്നറിയപ്പെടുന്നത് ആരാണ്?',
    options: [
      'മഹാത്മാ ഗാന്ധി',
      'ജവഹർലാൽ നെഹ്‌റു',
      'സർദാർ വല്ലഭായ് പട്ടേൽ',
      'ഡോ. ബി. ആർ. അംബേദ്കർ'
    ],
    correctIndex: 3, // D: ഡോ. ബി. ആർ. അംബേദ്കർ
    explanationLabel: 'വിശദീകരണം',
    explanation: 'ഭരണഘടനാ നിർമ്മാണ സഭയുടെ ഡ്രാഫ്റ്റിംഗ് കമ്മിറ്റി ചെയർമാനായിരുന്നു ഡോ. ബി. ആർ. അംബേദ്കർ.',
    category: 'ഇന്ത്യൻ ഭരണഘടന',
  },
  {
    id: 'ml_q3',
    question: 'ഒരു ട്രെയിൻ 72 km/h വേഗതയിൽ 20 സെക്കൻഡിൽ 200 മീറ്റർ നീളമുള്ള പ്ലാറ്റ്ഫോം മറികടക്കുന്നു. ട്രെയിനിന്റെ നീളം എത്ര?',
    options: ['150 മീറ്റർ', '200 മീറ്റർ', '250 മീറ്റർ', '300 മീറ്റർ'],
    correctIndex: 1, // B: 200 മീറ്റർ
    explanationLabel: 'ഗണിത പരിഹാരം',
    explanation: 'സ്റ്റെപ്പ് 1: വേഗത m/s ലേക്ക് മാറ്റുക: 72 × (5/18) = 20 m/s.\nസ്റ്റെപ്പ് 2: ആകെ ദൂരം = വേഗത × സമയം = 20 × 20 = 400 മീറ്റർ.\nസ്റ്റെപ്പ് 3: ട്രെയിനിന്റെ നീളം = ആകെ ദൂരം - പ്ലാറ്റ്ഫോം = 400 - 200 = 200 മീറ്റർ.',
    category: 'ഗണിതം & കണക്ക്',
  },
  {
    id: 'ml_q4',
    question: 'കേരളത്തിലെ ഏറ്റവും നീളം കൂടിയ നദി ഏതാണ്?',
    options: ['ഭാരതപ്പുഴ', 'പെരിയാർ', 'പമ്പ', 'ചാലിയാർ'],
    correctIndex: 1, // B: പെരിയാർ
    explanationLabel: 'പ്രധാന വിവരങ്ങൾ',
    explanation: '244 കിലോമീറ്റർ നീളമുള്ള പെരിയാറാണ് കേരളത്തിലെ ഏറ്റവും നീളം കൂടിയ നദി.',
    category: 'കേരള ഭൂമിശാസ്ത്രം',
  },
];

const DEFAULT_QUIZ: QuizConfig = {
  title: 'Auorta Learning Quiz Challenge',
  theme: 'neon-cyber',
  aspectRatio: '9:16',
  readingDuration: 4.5,
  countdownDuration: 4.0,
  revealDuration: 2.8,
  finalScreenDuration: 3.5,
  enableBgm: true,
  bgmVolume: 0.35,
  enableSfx: true,
  sfxVolume: 0.8,
  fps: 30,
  questions: [
    {
      id: 'q1',
      question: 'Consider the following statements regarding the Solar System:',
      statements: [
        '1. Saturn has the highest number of confirmed moons (146 moons).',
        '2. Jupiter is the largest planet in our solar system by mass and volume.',
        '3. Venus has the highest average surface temperature due to dense CO2 atmosphere.'
      ],
      questionFooter: 'Which of the statements given above are correct?',
      options: ['1 and 2 only', '2 and 3 only', '1 and 3 only', '1, 2, and 3 (All)'],
      correctIndex: 3, // D: 1, 2, and 3
      explanationLabel: 'Key Fact & Solution',
      explanation: 'All three statements are correct! Saturn currently has 146 confirmed moons, and Venus reaches ~465°C due to extreme greenhouse effect.',
      category: 'Astronomy',
    },
    {
      id: 'q2',
      question: 'Find the value of x in the linear equation:',
      statements: [
        'Given Equation: 3x - 7 = 2(x + 4)'
      ],
      questionFooter: 'What is the value of x that satisfies this equation?',
      options: ['x = 11', 'x = 15', 'x = 18', 'x = 22'],
      correctIndex: 1, // B: x = 15
      explanationLabel: 'Maths Solution',
      explanation: 'Step 1: Expand the right side: 3x - 7 = 2x + 8\nStep 2: Subtract 2x from both sides: x - 7 = 8\nStep 3: Add 7 to both sides: x = 15\nTherefore, Option B (x = 15) is correct.',
      category: 'Mathematics',
    },
    {
      id: 'q3',
      question: 'With reference to the Constitution of India, consider the following statements:',
      statements: [
        '1. Dr. B. R. Ambedkar served as the Chairman of the Drafting Committee.',
        '2. The Constitution was officially adopted on 26th November 1949.'
      ],
      questionFooter: 'Which of the statements given above is/are correct?',
      options: ['1 only', '2 only', 'Both 1 and 2', 'Neither 1 nor 2'],
      correctIndex: 2, // C: Both 1 and 2
      explanationLabel: 'Exam Solution',
      explanation: 'Both statements are correct! The Constituent Assembly adopted the Constitution on 26 Nov 1949 and it came into effect on 26 Jan 1950.',
      category: 'Indian Polity',
    },
    {
      id: 'q4',
      question: 'A train running at 72 km/h crosses a 200m platform in 20 seconds. What is the length of the train?',
      options: ['150 m', '200 m', '250 m', '300 m'],
      correctIndex: 1, // B: 200 m
      explanationLabel: 'Step-by-Step Solution',
      explanation: 'Step 1: Convert speed to m/s: 72 × (5/18) = 20 m/s.\nStep 2: Total distance = Speed × Time = 20 × 20 = 400 m.\nStep 3: Length of train = Total distance - Platform = 400 - 200 = 200 m.',
      category: 'Aptitude & Maths',
    },
  ],
  promo: {
    enabled: true,
    appName: 'Auorta Learning App',
    headline: 'Download Auorta Learning App',
    description: 'Practice Full-Length Mock Tests & Solved Previous Year Questions. Available on Google Play!',
    ctaText: 'GET IT ON Google Play',
    tickerText: 'Download Auorta Learning App on Google Play for Mock Tests & PYQs',
    showTicker: true,
    showInFinalScreen: true,
  },
  voiceOver: {
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
  },
};

export default function App() {
  const [quiz, setQuiz] = useState<QuizConfig>(DEFAULT_QUIZ);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'split' | 'preview' | 'questions'>('split');
  const [isExporting, setIsExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [voiceOverModalOpen, setVoiceOverModalOpen] = useState(false);
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

  const handleLoadMalayalamQuiz = () => {
    setQuiz({
      ...quiz,
      title: 'Auorta Learning Malayalam Quiz Challenge',
      questions: MALAYALAM_SAMPLE_QUESTIONS,
      voiceOver: {
        ...(quiz.voiceOver || {
          enabled: true,
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          readQuestion: true,
          readStatements: true,
          readOptions: true,
          announceAnswerOnReveal: true,
          readExplanation: true,
        }),
        language: 'ml', // Force Malayalam voice
      },
    });
    setActiveQuestionIndex(0);
  };

  const handleAddQuestionHeader = () => {
    const newIndex = quiz.questions.length;
    const defaultCorrect = newIndex % 4; // Alternate A, B, C, D
    const newQ: QuizQuestion = {
      id: `q_${Date.now()}`,
      question: `New Question #${newIndex + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: defaultCorrect,
      explanationLabel: 'Solution',
      explanation: 'Explanation / solution for the correct answer.',
    };
    setQuiz({ ...quiz, questions: [...quiz.questions, newQ] });
    setActiveQuestionIndex(newIndex);
  };

  const handleImportJsonQuiz = (
    newQuestions: QuizQuestion[],
    newTitle?: string,
    mode: 'replace' | 'append' = 'replace'
  ) => {
    if (mode === 'replace') {
      setQuiz({
        ...quiz,
        title: newTitle || quiz.title,
        questions: newQuestions,
      });
      setActiveQuestionIndex(0);
    } else {
      const merged = [...quiz.questions, ...newQuestions];
      setQuiz({
        ...quiz,
        questions: merged,
      });
      setActiveQuestionIndex(quiz.questions.length);
    }
  };

  const handleUpdateVoiceOver = (config: VoiceOverConfig) => {
    setQuiz({
      ...quiz,
      voiceOver: config,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Film className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-lg tracking-tight text-white truncate">
                  QuizCraft MP4
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Shorts & 16:9 MP4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                Auorta Challenge • Malayalam & English Natural Voice-Over • Zero Backend
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
            {/* Voice-Over Check Modal Button in header */}
            <button
              onClick={() => setVoiceOverModalOpen(true)}
              className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl font-bold bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 flex items-center gap-1 sm:gap-1.5 text-xs transition"
              title="Check natural voice-over in Malayalam or English"
            >
              <Mic className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Check Voice-Over</span>
              <span className="sm:hidden">Voice</span>
            </button>

            {/* Import JSON button in top header */}
            <button
              onClick={() => setJsonModalOpen(true)}
              className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl font-bold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 sm:gap-1.5 text-xs transition"
              title="Import or paste JSON questions"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Import JSON</span>
              <span className="sm:hidden">JSON</span>
            </button>

            {/* Direct Add Question Button in top header */}
            <button
              onClick={handleAddQuestionHeader}
              className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 sm:gap-1.5 text-xs transition"
              title="Add a new question"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">+ Add Question</span>
              <span className="md:hidden">+ Q</span>
            </button>

            {/* Export MP4 button */}
            <button
              onClick={handleStartExport}
              disabled={isExporting}
              className="py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-1 sm:gap-1.5 shadow-lg shadow-emerald-500/25 text-xs transition active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export MP4</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-8">
        {/* Verification banner with View Toggles for responsive layout */}
        <div className="mb-4 sm:mb-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-white block">
                {quiz.title} • {quiz.questions.length} Questions
              </span>
              <span className="text-slate-400">
                Natural Voice-Over (Malayalam & English) • Statement Questions • Step-by-Step Maths Solutions.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
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
                <span>Split</span>
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Canvas Focus"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Canvas</span>
              </button>
              <button
                onClick={() => setViewMode('questions')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === 'questions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Questions & Settings"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Editor</span>
              </button>
            </div>

            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 font-mono text-[11px]">
              {quiz.aspectRatio === '9:16' ? '720x1280 (Shorts)' : '1280x720 (16:9)'}
            </span>
          </div>
        </div>

        {/* Dynamic Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Canvas Preview Column */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div className={viewMode === 'preview' ? 'lg:col-span-12 max-w-3xl mx-auto w-full' : 'lg:col-span-6 xl:col-span-6 w-full'}>
              <VideoPreview
                quiz={quiz}
                onUpdateQuiz={setQuiz}
                onExportClick={handleStartExport}
                onOpenJsonModal={() => setJsonModalOpen(true)}
                onOpenVoiceOverModal={() => setVoiceOverModalOpen(true)}
                isExporting={isExporting}
                activeQuestionIndex={activeQuestionIndex}
                setActiveQuestionIndex={setActiveQuestionIndex}
              />
            </div>
          )}

          {/* Quiz Configuration Column */}
          {(viewMode === 'split' || viewMode === 'questions') && (
            <div className={viewMode === 'questions' ? 'lg:col-span-12 max-w-4xl mx-auto w-full' : 'lg:col-span-6 xl:col-span-6 w-full'}>
              <QuizEditor
                quiz={quiz}
                onUpdateQuiz={setQuiz}
                onResetDefault={handleResetDefaults}
                onOpenJsonModal={() => setJsonModalOpen(true)}
                onOpenVoiceOverModal={() => setVoiceOverModalOpen(true)}
                onLoadMalayalamSample={handleLoadMalayalamQuiz}
                activeQuestionIndex={activeQuestionIndex}
                setActiveQuestionIndex={setActiveQuestionIndex}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        <p>QuizCraft • Client-Side Offline MP4 Generator & Natural Voice-Over • Auorta Learning App Campaign</p>
      </footer>

      {/* Voice-Over Narration Modal */}
      <VoiceOverModal
        quiz={quiz}
        isOpen={voiceOverModalOpen}
        onClose={() => setVoiceOverModalOpen(false)}
        onUpdateVoiceOver={handleUpdateVoiceOver}
        onLoadMalayalamSample={handleLoadMalayalamQuiz}
        activeQuestionIndex={activeQuestionIndex}
        setActiveQuestionIndex={setActiveQuestionIndex}
      />

      {/* JSON Import & Paste Modal */}
      <JsonImportModal
        quiz={quiz}
        isOpen={jsonModalOpen}
        onClose={() => setJsonModalOpen(false)}
        onImportQuiz={handleImportJsonQuiz}
      />

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
