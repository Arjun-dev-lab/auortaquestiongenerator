export interface QuizQuestion {
  id: string;
  question: string;
  options: [string, string, string, string]; // Exactly 4 options
  correctIndex: number; // 0, 1, 2, or 3
  explanation?: string;
  category?: string;
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

export interface QuizConfig {
  title: string;
  theme: QuizTheme;
  aspectRatio: '9:16' | '16:9';
  countdownDuration: number; // seconds per question countdown (e.g. 3.0)
  revealDuration: number; // seconds per question answer reveal (e.g. 2.0)
  finalScreenDuration: number; // seconds for final screen (e.g. 3.0)
  enableBgm: boolean;
  bgmVolume: number; // 0 to 1
  enableSfx: boolean;
  sfxVolume: number; // 0 to 1
  fps: number; // 30
  questions: QuizQuestion[];
  promo?: PromoConfig;
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
