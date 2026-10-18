import React, { useState } from 'react';
import { QuizConfig, QuizQuestion } from '../types/quiz';
import {
  X,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Sparkles,
  Layers,
  BookOpen,
  Calculator,
} from 'lucide-react';

interface Props {
  quiz: QuizConfig;
  isOpen: boolean;
  onClose: () => void;
  onImportQuiz: (newQuestions: QuizQuestion[], newTitle?: string, mode?: 'replace' | 'append') => void;
}

const SAMPLE_STATEMENT_QUIZ = {
  title: 'Auorta Learning Quiz Challenge',
  questions: [
    {
      question: 'Consider the following statements regarding the Solar System:',
      statements: [
        '1. Saturn has the highest number of confirmed moons (146 moons).',
        '2. Jupiter is the largest planet in our solar system by mass and volume.',
        '3. Venus has the hottest average surface temperature due to dense carbon dioxide atmosphere.'
      ],
      questionFooter: 'Which of the statements given above are correct?',
      options: [
        '1 and 2 only',
        '2 and 3 only',
        '1 and 3 only',
        '1, 2, and 3 (All)'
      ],
      answer: 'D',
      explanationLabel: 'Solution & Key Fact',
      explanation: 'All three statements are correct! Saturn currently has 146 confirmed moons, and Venus reaches ~465°C due to extreme greenhouse effect.',
      category: 'Astronomy'
    },
    {
      question: 'Find the roots of the quadratic equation: x² - 5x + 6 = 0',
      statements: [
        'Condition: a = 1, b = -5, c = 6',
        'Formula: Factorize into (x - p)(x - q) = 0'
      ],
      questionFooter: 'What are the two solutions for x?',
      options: [
        'x = 1 and x = 6',
        'x = 2 and x = 3',
        'x = -2 and x = -3',
        'x = 0 and x = 5'
      ],
      answer: 'B',
      explanationLabel: 'Maths Solution',
      explanation: 'Step 1: Find two numbers whose product is 6 and sum is -5. These are -2 and -3.\nStep 2: (x - 2)(x - 3) = 0\nStep 3: x = 2 or x = 3.\nTherefore, Option B is the correct solution.',
      category: 'Mathematics'
    },
    {
      question: 'A train running at 72 km/h crosses a 200m platform in 20 seconds. What is the length of the train?',
      options: [
        '150 m',
        '200 m',
        '250 m',
        '300 m'
      ],
      answer: 'B',
      explanationLabel: 'Step-by-Step Solution',
      explanation: 'Step 1: Convert speed to m/s: 72 × (5/18) = 20 m/s.\nStep 2: Total distance = Speed × Time = 20 × 20 = 400 m.\nStep 3: Length of train = Total distance - Platform length = 400 - 200 = 200 m.',
      category: 'Aptitude'
    },
    {
      question: 'Which of the following Fundamental Rights cannot be suspended even during a National Emergency?',
      options: [
        'Right to Equality (Articles 14-18)',
        'Right to Freedom of Speech (Article 19)',
        'Protection of Life & Personal Liberty (Articles 20 & 21)',
        'Right to Constitutional Remedies (Article 32)'
      ],
      answer: 'C',
      explanationLabel: 'Exam Solution',
      explanation: 'By the 44th Constitutional Amendment Act (1978), the Right to Life and Personal Liberty under Articles 20 and 21 cannot be suspended even during National Emergency.',
      category: 'Indian Polity'
    }
  ]
};

export const JsonImportModal: React.FC<Props> = ({
  quiz,
  isOpen,
  onClose,
  onImportQuiz,
}) => {
  const [jsonInput, setJsonInput] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    title?: string;
    questions: QuizQuestion[];
  } | null>(null);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real-time JSON parser & validator with flexible schema support
  const handleTextChange = (text: string) => {
    setJsonInput(text);
    if (!text.trim()) {
      setValidationError(null);
      setParsedPreview(null);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      let rawQuestions: any[] = [];
      let quizTitle: string | undefined = undefined;

      if (Array.isArray(parsed)) {
        rawQuestions = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray(parsed.questions)) {
          rawQuestions = parsed.questions;
          if (typeof parsed.title === 'string') quizTitle = parsed.title;
        } else if (parsed.question) {
          rawQuestions = [parsed];
        } else {
          throw new Error('JSON must contain a "questions" array or be an array of question objects.');
        }
      }

      if (rawQuestions.length === 0) {
        throw new Error('No questions found in JSON.');
      }

      const letterMap: Record<string, number> = {
        a: 0,
        b: 1,
        c: 2,
        d: 3,
        '1': 0,
        '2': 1,
        '3': 2,
        '4': 3,
      };

      const normalized: QuizQuestion[] = rawQuestions.map((q: any, idx: number) => {
        // Question prompt
        const prompt = typeof q.question === 'string' ? q.question.trim() : `Question #${idx + 1}`;

        // Statements (array or string)
        let statements: string[] | undefined = undefined;
        if (Array.isArray(q.statements)) {
          statements = q.statements.map((s: any) => String(s).trim()).filter(Boolean);
        } else if (typeof q.statements === 'string' && q.statements.trim()) {
          statements = q.statements.split('\n').map((s: string) => s.trim()).filter(Boolean);
        }

        // Question footer
        const questionFooter = typeof q.questionFooter === 'string' ? q.questionFooter.trim() : undefined;

        // Options
        let optionsArr: string[] = [];
        if (Array.isArray(q.options)) {
          optionsArr = q.options.map((o: any) => String(o).trim());
        }
        while (optionsArr.length < 4) {
          optionsArr.push(`Option ${String.fromCharCode(65 + optionsArr.length)}`);
        }
        const options = optionsArr.slice(0, 4) as [string, string, string, string];

        // Correct Answer
        let correctIdx = 0;
        const rawAns = q.answer ?? q.correctIndex ?? q.correct ?? q.correctAnswer;
        if (typeof rawAns === 'number' && rawAns >= 0 && rawAns <= 3) {
          correctIdx = rawAns;
        } else if (typeof rawAns === 'string') {
          const trimmed = rawAns.trim().toLowerCase();
          if (trimmed in letterMap) {
            correctIdx = letterMap[trimmed];
          } else {
            // Check if matches option text
            const foundIdx = options.findIndex((opt) => opt.toLowerCase() === trimmed);
            if (foundIdx !== -1) correctIdx = foundIdx;
          }
        }

        // Explanation / Solution & Label
        const explanation =
          typeof q.explanation === 'string'
            ? q.explanation
            : typeof q.solution === 'string'
            ? q.solution
            : typeof q.fact === 'string'
            ? q.fact
            : undefined;

        const explanationLabel =
          typeof q.explanationLabel === 'string'
            ? q.explanationLabel
            : typeof q.solutionLabel === 'string'
            ? q.solutionLabel
            : undefined;

        const category = typeof q.category === 'string' ? q.category.trim() : undefined;

        return {
          id: q.id || `q_${Date.now()}_${idx}`,
          question: prompt,
          statements: statements && statements.length > 0 ? statements : undefined,
          questionFooter,
          options,
          correctIndex: correctIdx,
          explanation,
          explanationLabel,
          category,
        };
      });

      setValidationError(null);
      setParsedPreview({
        title: quizTitle,
        questions: normalized,
      });
    } catch (err: any) {
      setValidationError(err.message || 'Invalid JSON syntax');
      setParsedPreview(null);
    }
  };

  const handleApply = (mode: 'replace' | 'append') => {
    if (!parsedPreview || parsedPreview.questions.length === 0) return;
    onImportQuiz(parsedPreview.questions, parsedPreview.title, mode);
    onClose();
  };

  const loadSample = (sample: any) => {
    const formatted = JSON.stringify(sample, null, 2);
    setJsonInput(formatted);
    handleTextChange(formatted);
  };

  const exportCurrentQuiz = () => {
    const data = {
      title: quiz.title,
      questions: quiz.questions.map((q) => ({
        question: q.question,
        statements: q.statements,
        questionFooter: q.questionFooter,
        options: q.options,
        answer: ['A', 'B', 'C', 'D'][q.correctIndex],
        explanationLabel: q.explanationLabel,
        explanation: q.explanation,
        category: q.category,
      })),
    };
    const formatted = JSON.stringify(data, null, 2);
    setJsonInput(formatted);
    handleTextChange(formatted);
    navigator.clipboard?.writeText(formatted);
    setCopiedStatus('Current quiz JSON copied to clipboard!');
    setTimeout(() => setCopiedStatus(null), 3000);
  };

  const copyTemplate = () => {
    const formatted = JSON.stringify(SAMPLE_STATEMENT_QUIZ, null, 2);
    navigator.clipboard?.writeText(formatted);
    setCopiedStatus('Sample JSON copied to clipboard!');
    setTimeout(() => setCopiedStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Import Questions from JSON
              </h2>
              <p className="text-xs text-slate-400">
                Paste JSON text to immediately populate questions, statements, options, and maths solutions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Quick Chips */}
        <div className="p-3 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
          <span className="text-slate-400 font-semibold shrink-0">Quick Templates:</span>

          <button
            onClick={() => loadSample(SAMPLE_STATEMENT_QUIZ)}
            className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5 shrink-0 transition"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Load Statement & Maths Quiz</span>
          </button>

          <button
            onClick={copyTemplate}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 shrink-0 transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Template JSON</span>
          </button>

          <button
            onClick={exportCurrentQuiz}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 shrink-0 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Current Quiz JSON</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {copiedStatus && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{copiedStatus}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                Paste JSON Text Here (Supports Statement & Standard Questions):
              </label>
              <span className="text-[11px] text-slate-400">
                Format: <code className="text-sky-400 font-mono">&#123; question, statements?, options, answer, explanation &#125;</code>
              </span>
            </div>

            <textarea
              value={jsonInput}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`{\n  "title": "Auorta Learning Quiz Challenge",\n  "questions": [\n    {\n      "question": "Consider the following statements regarding photosynthesis:",\n      "statements": [\n        "1. Chlorophyll absorbs blue and red light.",\n        "2. Oxygen is released as a byproduct."\n      ],\n      "questionFooter": "Which statement(s) is/are correct?",\n      "options": ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"],\n      "answer": "C",\n      "explanationLabel": "Solution",\n      "explanation": "Both statements are correct. Chlorophyll absorbs red/blue light and photolysis of water yields oxygen."\n    }\n  ]\n}`}
              rows={10}
              className="w-full bg-slate-950 font-mono text-xs text-slate-200 border border-slate-700/80 rounded-xl p-3.5 focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          {/* Validation Status & Live Preview */}
          {validationError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">JSON Syntax Error:</span>
                <span className="text-[11px] opacity-90">{validationError}</span>
              </div>
            </div>
          )}

          {parsedPreview && (
            <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-xs text-emerald-300">
                    Valid JSON: {parsedPreview.questions.length} Question{parsedPreview.questions.length > 1 ? 's' : ''} Ready to Load
                  </span>
                </div>
                {parsedPreview.title && (
                  <span className="text-[11px] text-slate-400 font-semibold truncate max-w-[200px]">
                    Title: "{parsedPreview.title}"
                  </span>
                )}
              </div>

              {/* Quick list of parsed questions */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {parsedPreview.questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg text-xs border border-slate-800"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="font-bold text-indigo-400 shrink-0">Q{idx + 1}.</span>
                      <span className="truncate text-slate-300">{q.question}</span>
                      {q.statements && q.statements.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 shrink-0">
                          {q.statements.length} Statements
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 shrink-0">
                      Ans: {['A', 'B', 'C', 'D'][q.correctIndex]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition order-2 sm:order-1"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            <button
              onClick={() => handleApply('append')}
              disabled={!parsedPreview}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 text-xs transition disabled:opacity-40"
              title="Add these questions to the end of the current quiz"
            >
              + Append ({parsedPreview?.questions.length || 0})
            </button>

            <button
              onClick={() => handleApply('replace')}
              disabled={!parsedPreview}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-40"
              title="Replace current quiz questions with these"
            >
              Load & Replace Quiz ({parsedPreview?.questions.length || 0})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
