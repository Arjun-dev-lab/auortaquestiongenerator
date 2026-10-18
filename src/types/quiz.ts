export interface QuizQuestion {
  id: string;
  question: string;
  statements?: string[]; // Optional statement lines (e.g. ["1. Statement one", "2. Statement two"])
  questionFooter?: string; // Optional question closing prompt (e.g. "Which of the statements given above are correct?")
  options: [string, string, string, string]; // Exactly 4 options
  correctIndex: number; // 0, 1, 2, or 3
  explanation?: string; // Solution or fact text
  explanationLabel?: string; // e.g. "Solution", "Step-by-Step Solution", "Explanation", "Key Fact"
  category?: string;
  readingDuration?: number; // Custom seconds to read question & options before timer countdown starts
  audioUrl?: string; // Custom recorded microphone audio or uploaded MP3 for 100% natural voice
  audioDuration?: number; // Duration of custom audio in seconds
}

export type QuizTheme = 'neon-cyber' | 'sunset-pop' | 'trivia-royale' | 'emerald-quiz' | 'midnight-violet';

export interface QuizThemeConfig {
  id: QuizTheme;
  name: string;
  bgGradient: [string, string, string];
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accentColor: string;
  accentSecondary: string;
  correctBg: string;
  correctBorder: string;
  correctText: string;
  wrongBg: string;
  wrongBorder: string;
  wrongText: string;
}

export interface PromoConfig {
  enabled: boolean;
  appName: string; // "Auorta Learning App"
  headline: string; // "Boost Your Exam Preparation!"
  description: string; // "Access Full Mock Tests & Solved Previous Year Questions"
  ctaText: string; // "GET IT ON Google Play"
  tickerText: string; // "Download Auorta Learning App on Google Play for Mock Tests & PYQs"
  showTicker: boolean; // Show bottom ticker during questions
  showInFinalScreen: boolean; // Show card on final screen
}

export type VoiceLanguage = 'auto' | 'en' | 'ml';

export interface VoiceOverConfig {
  enabled: boolean;
  language: VoiceLanguage; // 'auto' | 'en' | 'ml'
  voiceURI?: string; // specific voice chosen by user
  rate: number; // 0.8 to 1.3 (default 1.0)
  pitch: number; // 0.8 to 1.2 (default 1.0)
  volume: number; // 0 to 1 (default 1.0)
  readQuestion: boolean; // default true
  readStatements: boolean; // default true
  readOptions: boolean; // default true
  announceAnswerOnReveal: boolean; // default true
  readExplanation: boolean; // default true
  syncWithVideoTimer?: boolean; // Timer begins ONLY when voice finishes
}

export interface QuizConfig {
  title: string;
  theme: QuizTheme;
  aspectRatio: '9:16' | '16:9';
  readingDuration?: number; // seconds to read question & options before countdown timer starts (default 4.5s)
  countdownDuration: number; // seconds for countdown timer AFTER reading is over (e.g. 4.0s)
  revealDuration: number; // seconds for answer reveal & announcement (e.g. 2.5s)
  finalScreenDuration: number; // seconds for final screen (e.g. 3.0s)
  enableBgm: boolean;
  bgmVolume: number; // 0 to 1
  enableSfx: boolean;
  sfxVolume: number; // 0 to 1
  fps: number; // 30
  questions: QuizQuestion[];
  promo?: PromoConfig;
  voiceOver?: VoiceOverConfig;
}

export interface ExportProgress {
  stage: 'idle' | 'audio' | 'encoding' | 'finalizing' | 'verifying' | 'done' | 'error';
  currentFrame: number;
  totalFrames: number;
  percent: number;
  message: string;
  currentFps?: number;
  error?: string;
}

export interface Mp4BoxInfo {
  type: string;
  offset: number;
  size: number;
  description?: string;
  children?: Mp4BoxInfo[];
}

export interface Mp4ValidationResult {
  isValidMp4: boolean;
  isWebm: boolean;
  fileSizeBytes: number;
  majorBrand: string;
  minorVersion: number;
  compatibleBrands: string[];
  boxesFound: string[];
  hasFtyp: boolean;
  hasMoov: boolean;
  hasMdat: boolean;
  hasVideoTrack: boolean;
  hasAudioTrack: boolean;
  videoCodec?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  first64BytesHex: string;
  rawBoxes: Mp4BoxInfo[];
  diagnostics: string[];
}
