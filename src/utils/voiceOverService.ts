import { QuizQuestion, VoiceOverConfig } from '../types/quiz';

/**
 * Client-Side Voice-Over Narration Service
 * 100% Free • Zero Paid APIs • Zero Backend • Browser Built-in Web Speech API
 * 
 * Features:
 * - Ultra-Natural Neural Voice auto-detection & ranking (Edge Natural, Google Neural, Siri)
 * - Anti-Robotic filtering (detects and filters out legacy eSpeak / desktop robotic voices)
 * - Sequenced Timing: Question Voice -> Voice Ends -> Countdown Begins -> Answer Reveal
 * - Natural cadence & phonetics formatting for both Malayalam (മലയാളം) and English
 * - In-Browser Studio Microphone recording for 100% genuine human voice
 */

export interface VoiceOption {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
  isNatural: boolean;
  isRoboticLegacy: boolean;
  qualityBadge: string;
  isMalayalam: boolean;
  isEnglish: boolean;
}

class VoiceOverService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private onStateChangeCallbacks: Set<(isPlaying: boolean, currentText?: string) => void> = new Set();
  private isSpeakingActive = false;

  // MediaRecorder for recording genuine human voice via microphone
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private initVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    this.isInitialized = true;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    if (!this.isInitialized || this.voices.length === 0) {
      this.voices = this.synth.getVoices();
    }
    return this.voices;
  }

  /**
   * Scores and categorizes voices, prioritizing natural neural voices (Edge / Chrome / Siri)
   * and clearly identifying legacy robotic voices.
   */
  public getCategorizedVoices(): {
    malayalam: VoiceOption[];
    english: VoiceOption[];
    other: VoiceOption[];
  } {
    const raw = this.getVoices();
    const result: {
      malayalam: VoiceOption[];
      english: VoiceOption[];
      other: VoiceOption[];
    } = {
      malayalam: [],
      english: [],
      other: [],
    };

    raw.forEach((v) => {
      const lowerName = v.name.toLowerCase();
      const lowerLang = v.lang.toLowerCase();

      // Legacy robotic voices that sound mechanical/metallic
      const isRoboticLegacy =
        lowerName.includes('espeak') ||
        lowerName.includes('desktop') ||
        lowerName.includes('david') ||
        lowerName.includes('zira') ||
        lowerName.includes('mark') ||
        lowerName.includes('sam') ||
        lowerName.includes('hazel') ||
        lowerName.includes('george') ||
        lowerName.includes('susan');

      // Natural neural online and enhanced voices
      const isNatural =
        !isRoboticLegacy &&
        (lowerName.includes('natural') ||
          lowerName.includes('neural') ||
          lowerName.includes('online') ||
          lowerName.includes('google') ||
          lowerName.includes('siri') ||
          lowerName.includes('enhanced') ||
          lowerName.includes('premium') ||
          lowerName.includes('multilingual') ||
          lowerName.includes('wavenet'));

      let qualityBadge = 'Standard Device';
      if (lowerName.includes('natural') || lowerName.includes('neural')) {
        qualityBadge = 'Ultra-Natural Neural ⭐';
      } else if (lowerName.includes('online')) {
        qualityBadge = 'Online Natural ⭐';
      } else if (lowerName.includes('google')) {
        qualityBadge = 'Google Natural';
      } else if (lowerName.includes('siri') || lowerName.includes('enhanced') || lowerName.includes('premium')) {
        qualityBadge = 'Enhanced Natural';
      } else if (isRoboticLegacy) {
        qualityBadge = 'Legacy Robotic';
      }

      const isMalayalam =
        lowerLang.startsWith('ml') ||
        lowerLang.includes('malayalam') ||
        lowerName.includes('malayalam') ||
        lowerName.includes('മലയാളം');

      const isEnglish = lowerLang.startsWith('en');

      const option: VoiceOption = {
        voice: v,
        name: v.name,
        lang: v.lang,
        isNatural,
        isRoboticLegacy,
        qualityBadge,
        isMalayalam,
        isEnglish,
      };

      if (isMalayalam) {
        result.malayalam.push(option);
      } else if (isEnglish) {
        result.english.push(option);
      } else {
        result.other.push(option);
      }
    });

    // Sort natural neural voices to the top; legacy robotic voices to the bottom
    const sortFn = (a: VoiceOption, b: VoiceOption) => {
      if (a.isNatural && !b.isNatural) return -1;
      if (!a.isNatural && b.isNatural) return 1;
      if (a.isRoboticLegacy && !b.isRoboticLegacy) return 1;
      if (!a.isRoboticLegacy && b.isRoboticLegacy) return -1;
      return a.name.localeCompare(b.name);
    };

    result.malayalam.sort(sortFn);
    result.english.sort(sortFn);
    result.other.sort(sortFn);

    return result;
  }

  /**
   * Detects if the given text contains Malayalam unicode characters
   */
  public isMalayalamText(text: string): boolean {
    const mlRegex = /[\u0D00-\u0D7F]/;
    return mlRegex.test(text);
  }

  /**
   * Resolves the best available natural voice for the given language preference and text.
   * Gives top priority to Online Natural Neural and Google voices.
   */
  public getBestVoice(
    langPreference: 'auto' | 'en' | 'ml',
    sampleText: string,
    specificVoiceURI?: string
  ): SpeechSynthesisVoice | null {
    const voices = this.getVoices();
    if (voices.length === 0) return null;

    // 1. User explicitly picked a specific voice
    if (specificVoiceURI) {
      const found = voices.find((v) => v.voiceURI === specificVoiceURI || v.name === specificVoiceURI);
      if (found) return found;
    }

    // 2. Determine target language: 'ml' or 'en'
    let targetLang = langPreference;
    if (targetLang === 'auto') {
      targetLang = this.isMalayalamText(sampleText) ? 'ml' : 'en';
    }

    // 3. Find candidate voices
    const candidates = voices.filter((v) => {
      const lowerLang = v.lang.toLowerCase();
      const lowerName = v.name.toLowerCase();
      if (targetLang === 'ml') {
        return (
          lowerLang.startsWith('ml') ||
          lowerLang.includes('malayalam') ||
          lowerName.includes('malayalam') ||
          lowerName.includes('മലയാളം')
        );
      } else {
        return lowerLang.startsWith('en');
      }
    });

    if (candidates.length > 0) {
      // Prioritize natural neural online voices (Edge / Chrome / Siri)
      const onlineNatural = candidates.find((v) => {
        const n = v.name.toLowerCase();
        return (
          (n.includes('online') && n.includes('natural')) ||
          n.includes('neural') ||
          n.includes('google') ||
          n.includes('enhanced') ||
          n.includes('siri') ||
          n.includes('premium')
        );
      });
      if (onlineNatural) return onlineNatural;

      // Filter out robotic legacy voices
      const nonRobotic = candidates.filter((v) => {
        const n = v.name.toLowerCase();
        return (
          !n.includes('espeak') &&
          !n.includes('desktop') &&
          !n.includes('david') &&
          !n.includes('zira') &&
          !n.includes('mark') &&
          !n.includes('sam')
        );
      });
      if (nonRobotic.length > 0) return nonRobotic[0];

      return candidates[0];
    }

    // Fallback if no specific language match:
    // If Malayalam was requested but no Malayalam voice is installed, check for Indian English voices (e.g. en-IN)
    // which pronounce subcontinental terms and names much more naturally than standard US/UK
    if (targetLang === 'ml') {
      const indianVoice = voices.find((v) => {
        const l = v.lang.toLowerCase();
        const n = v.name.toLowerCase();
        return (
          (l.includes('in') || n.includes('india')) &&
          (n.includes('natural') || n.includes('online') || n.includes('google'))
        );
      });
      if (indianVoice) return indianVoice;
    }

    // Best natural voice overall
    const anyNatural = voices.find((v) => {
      const n = v.name.toLowerCase();
      return (
        !n.includes('espeak') &&
        (n.includes('natural') || n.includes('neural') || n.includes('online') || n.includes('google'))
      );
    });
    if (anyNatural) return anyNatural;

    return voices.find((v) => v.default) || voices[0];
  }

  /**
   * Humanizes and formats text with natural breath pauses, commas, and clear pronunciation
   */
  public cleanTextForSpeech(text: string, isMalayalam: boolean): string {
    if (!text) return '';
    let cleaned = text.trim();

    // Expand common math and physics units for natural human reading
    cleaned = cleaned
      .replace(/\b(\d+)\s*km\/h\b/gi, isMalayalam ? '$1 കിലോമീറ്റർ പെർ അവർ' : '$1 kilometers per hour')
      .replace(/\b(\d+)\s*m\/s\b/gi, isMalayalam ? '$1 മീറ്റർ പെർ സെക്കൻഡ്' : '$1 meters per second')
      .replace(/\b(\d+)\s*m\b/gi, isMalayalam ? '$1 മീറ്റർ' : '$1 meters')
      .replace(/\b(\d+)\s*cm\b/gi, isMalayalam ? '$1 സെന്റിമീറ്റർ' : '$1 centimeters')
      .replace(/\b(\d+)\s*sec\b/gi, isMalayalam ? '$1 സെക്കൻഡുകൾ' : '$1 seconds')
      .replace(/\b(\d+)\s*min\b/gi, isMalayalam ? '$1 മിനിറ്റുകൾ' : '$1 minutes')
      .replace(/=/g, isMalayalam ? ' സമം ' : ' equals ')
      .replace(/\+/g, isMalayalam ? ' പ്ലസ് ' : ' plus ')
      .replace(/\*/g, isMalayalam ? ' ഗുണനം ' : ' multiplied by ')
      .replace(/\//g, ' / ');

    // Normalize multiple spaces or line breaks
    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned;
  }

  /**
   * Generates formatted voice narration scripts with natural conversational pauses
   */
  public buildNarrationScripts(
    question: QuizQuestion,
    config: VoiceOverConfig
  ): {
    questionScript: string;
    revealScript: string;
    isMalayalam: boolean;
  } {
    const letters = ['A', 'B', 'C', 'D'];
    const mlLetters = ['എ', 'ബി', 'സി', 'ഡി'];

    const fullQuestionContent = `${question.question} ${question.statements?.join(' ') || ''} ${question.options.join(' ')}`;
    let isMalayalam = config.language === 'ml';
    if (config.language === 'auto') {
      isMalayalam = this.isMalayalamText(fullQuestionContent);
    }

    // --- PHASE 1: QUESTION & OPTIONS SCRIPT ---
    const qParts: string[] = [];

    if (config.readQuestion !== false && question.question) {
      const qClean = this.cleanTextForSpeech(question.question, isMalayalam);
      qParts.push(`${qClean}.`);
    }

    // Statements reading
    if (config.readStatements !== false && question.statements && question.statements.length > 0) {
      if (isMalayalam) {
        qParts.push('പ്രസ്താവനകൾ ശ്രദ്ധിക്കുക:');
        question.statements.forEach((st, idx) => {
          const stClean = this.cleanTextForSpeech(st, isMalayalam);
          qParts.push(`പ്രസ്താവന ${idx + 1}: ${stClean}.`);
        });
      } else {
        qParts.push('Consider these statements:');
        question.statements.forEach((st, idx) => {
          const stClean = this.cleanTextForSpeech(st, isMalayalam);
          qParts.push(`Statement ${idx + 1}: ${stClean}.`);
        });
      }
    }

    // Question Footer prompt
    if (question.questionFooter) {
      const fClean = this.cleanTextForSpeech(question.questionFooter, isMalayalam);
      qParts.push(`${fClean}.`);
    }

    // Options reading with natural human cadence and breath pauses
    if (config.readOptions !== false) {
      if (isMalayalam) {
        const o0 = this.cleanTextForSpeech(question.options[0], true);
        const o1 = this.cleanTextForSpeech(question.options[1], true);
        const o2 = this.cleanTextForSpeech(question.options[2], true);
        const o3 = this.cleanTextForSpeech(question.options[3], true);
        qParts.push(
          `ഓപ്ഷൻ എ: ${o0}, ... ഓപ്ഷൻ ബി: ${o1}, ... ഓപ്ഷൻ സി: ${o2}, ... ഓപ്ഷൻ ഡി: ${o3}.`
        );
      } else {
        const o0 = this.cleanTextForSpeech(question.options[0], false);
        const o1 = this.cleanTextForSpeech(question.options[1], false);
        const o2 = this.cleanTextForSpeech(question.options[2], false);
        const o3 = this.cleanTextForSpeech(question.options[3], false);
        qParts.push(
          `Option A: ${o0}, ... Option B: ${o1}, ... Option C: ${o2}, ... Option D: ${o3}.`
        );
      }
    }

    // --- PHASE 3: REVEAL SCRIPT ---
    const rParts: string[] = [];
    const correctLetter = letters[question.correctIndex] || 'A';
    const correctMlLetter = mlLetters[question.correctIndex] || 'എ';
    const rawCorrectText = question.options[question.correctIndex] || '';
    const correctText = this.cleanTextForSpeech(rawCorrectText, isMalayalam);

    if (config.announceAnswerOnReveal !== false) {
      if (isMalayalam) {
        rParts.push(`ശരിയായ ഉത്തരം, ഓപ്ഷൻ ${correctMlLetter}: ${correctText}!`);
      } else {
        rParts.push(`The correct answer is Option ${correctLetter}: ${correctText}!`);
      }
    }

    // Solution / Fact explanation
    if (config.readExplanation !== false && question.explanation) {
      const label = question.explanationLabel || (isMalayalam ? 'വിശദീകരണം' : 'Solution');
      const expClean = this.cleanTextForSpeech(question.explanation, isMalayalam);
      rParts.push(`${label}: ${expClean}.`);
    }

    return {
      questionScript: qParts.join(' '),
      revealScript: rParts.join(' '),
      isMalayalam,
    };
  }

  /**
   * Speaks a string of text with natural human tuning:
   * - Uses pitch = 1.0 (strict requirement to prevent Edge/Chrome Natural Online Neural voices from dropping to robotic offline fallback)
   * - Uses rate = 0.95 (relaxed conversational human pace instead of fast robotic reading)
   */
  public speakText(
    text: string,
    config: VoiceOverConfig,
    onEnd?: () => void
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth || !text.trim()) {
        if (onEnd) onEnd();
        resolve();
        return;
      }

      this.stop();
      this.isSpeakingActive = true;
      this.notifyState(true, text);

      const utterance = new SpeechSynthesisUtterance(text);
      const chosenVoice = this.getBestVoice(config.language, text, config.voiceURI);

      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang;
      } else {
        utterance.lang = config.language === 'ml' ? 'ml-IN' : 'en-US';
      }

      // CRITICAL FOR NATURAL VOICES:
      // Neural Online voices in Microsoft Edge and Chrome do not support arbitrary pitch shifts.
      // Keeping pitch strictly at 1.0 ensures the high-definition neural engine is maintained.
      utterance.pitch = 1.0;
      // Speech rate: slightly relaxed (0.95 for English, 0.92 for Malayalam) for natural human diction
      const baseRate = this.isMalayalamText(text) ? 0.92 : 0.95;
      utterance.rate = config.rate ? Math.max(0.7, Math.min(1.3, config.rate)) : baseRate;
      utterance.volume = config.volume !== undefined ? Math.max(0, Math.min(1.0, config.volume)) : 1.0;

      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        this.isSpeakingActive = false;
        this.currentUtterance = null;
        this.notifyState(false);
        if (onEnd) onEnd();
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn('Speech synthesis notice:', e);
        finish();
      };

      // Safeguard timeout in case browser speech engine hangs on long utterances
      const wordCount = text.split(/\s+/).length;
      const maxSeconds = Math.max(12, wordCount * 0.9 + 5);
      const timerId = setTimeout(() => {
        if (!resolved) {
          console.warn('Speech timeout safety fired');
          this.stop();
          finish();
        }
      }, maxSeconds * 1000);

      this.currentUtterance = utterance;
      this.synth.speak(utterance);

      // Clean up timeout on completion
      const originalFinish = finish;
      utterance.onend = () => {
        clearTimeout(timerId);
        originalFinish();
      };
    });
  }

  /**
   * Audition a specific voice with a short natural human test sentence
   */
  public testSingleVoice(voice: SpeechSynthesisVoice, isMalayalam: boolean): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve();
        return;
      }
      this.stop();

      const testPhrase = isMalayalam
        ? 'നമസ്കാരം! ഇത് ക്വിസ്ക്രാഫ്റ്റ് നാച്വറൽ വോയ്‌സ് ഓവറാണ്.'
        : 'Hello! This is QuizCraft natural human voice-over narration.';

      const utterance = new SpeechSynthesisUtterance(testPhrase);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = isMalayalam ? 0.92 : 0.95;
      utterance.pitch = 1.0; // Keep 1.0 for neural fidelity
      utterance.volume = 1.0;

      this.isSpeakingActive = true;
      this.notifyState(true, testPhrase);

      utterance.onend = () => {
        this.isSpeakingActive = false;
        this.notifyState(false);
        resolve();
      };
      utterance.onerror = () => {
        this.isSpeakingActive = false;
        this.notifyState(false);
        resolve();
      };

      this.synth.speak(utterance);
    });
  }

  /**
   * Complete Question Narration Audition with STRICT Sequenced Timing:
   * 
   * Requirement: "The timing is not interrupt the voice, if voice is over then only the timer begins."
   * 
   * Phase 1: Question & Options reading (voice speaks question and options; timer holds steady at full duration!)
   * Phase 2: ONLY AFTER voice is over -> Countdown Timer begins (ticks: 4... 3... 2... 1... 0)
   * Phase 3: Countdown hits 0 -> Reveal correct answer & explanation (fanfare sound, green card, voice announcement)
   */
  public async checkQuestionVoiceOver(
    question: QuizQuestion,
    config: VoiceOverConfig,
    countdownSecs = 4.0,
    onProgress?: (
      phase: 'reading_question' | 'waiting_timer' | 'revealing_answer' | 'done',
      timerCountdown?: number,
      text?: string
    ) => void,
    onTick?: (remainingSec: number) => void
  ): Promise<void> {
    if (!this.synth) {
      if (onProgress) onProgress('done');
      return;
    }
    this.stop();

    const scripts = this.buildNarrationScripts(question, config);

    // --- PHASE 1: READ QUESTION & OPTIONS ---
    // Timer DOES NOT count down while voice is speaking!
    if (onProgress) onProgress('reading_question', countdownSecs, scripts.questionScript);
    await this.speakText(scripts.questionScript, config);

    // If stopped mid-way by user
    if (!this.isSpeakingActive && this.currentUtterance === null && this.synth.speaking === false) {
      // Natural brief breath pause before countdown
      await new Promise((r) => setTimeout(r, 400));
    }

    // --- PHASE 2: VOICE IS OVER -> NOW AND ONLY NOW THE TIMER BEGINS! ---
    const totalCount = Math.max(2, Math.ceil(countdownSecs));
    for (let c = totalCount; c >= 1; c--) {
      if (onProgress) onProgress('waiting_timer', c, `Countdown: ${c}...`);
      if (onTick) onTick(c);
      await new Promise((r) => setTimeout(r, 1000));
    }

    // --- PHASE 3: TIMER REACHES 0 -> REVEAL CORRECT ANSWER & SOLUTION ---
    if (onProgress) onProgress('revealing_answer', 0, scripts.revealScript);
    await this.speakText(scripts.revealScript, config);

    // --- PHASE 4: DONE ---
    if (onProgress) onProgress('done', 0, 'Completed');
  }

  /**
   * Stop any ongoing speech immediately
   */
  public stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {
        // ignore
      }
    }
    this.isSpeakingActive = false;
    this.currentUtterance = null;
    this.notifyState(false);
  }

  public isSpeaking(): boolean {
    return this.isSpeakingActive || (this.synth ? this.synth.speaking : false);
  }

  public subscribeState(callback: (isPlaying: boolean, currentText?: string) => void): () => void {
    this.onStateChangeCallbacks.add(callback);
    return () => this.onStateChangeCallbacks.delete(callback);
  }

  private notifyState(isPlaying: boolean, text?: string) {
    // Schedule asynchronously to guarantee it never fires synchronously during a React render/commit phase
    setTimeout(() => {
      this.onStateChangeCallbacks.forEach((cb) => {
        try {
          cb(isPlaying, text);
        } catch (e) {
          // ignore
        }
      });
    }, 0);
  }

  // --- IN-BROWSER MICROPHONE STUDIO RECORDING (100% Genuine Human Voice) ---
  public async startMicRecording(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Microphone access is not supported in this browser.');
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.start();
      return true;
    } catch (err) {
      console.error('Failed to start microphone recording:', err);
      return false;
    }
  }

  public stopMicRecording(): Promise<{ audioUrl: string; duration: number } | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        const tempAudio = new Audio(audioUrl);
        tempAudio.onloadedmetadata = () => {
          const duration = tempAudio.duration || 5.0;
          resolve({ audioUrl, duration });
        };
        tempAudio.onerror = () => {
          resolve({ audioUrl, duration: 5.0 });
        };
      };

      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    });
  }
}

export const voiceOverService = new VoiceOverService();
