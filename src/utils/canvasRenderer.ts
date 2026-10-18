import { QuizConfig, QuizQuestion } from '../types/quiz';
import { QUIZ_THEMES } from './themes';

export interface CanvasRenderingContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap?: CanvasLineCap;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  fill(): void;
  stroke(): void;
  save(): void;
  restore(): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  roundRect?(x: number, y: number, w: number, h: number, radii: number | number[]): void;
}

// Fallback helper for roundRect
function drawRoundedRect(
  ctx: CanvasRenderingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2);
  ctx.closePath();
}

/**
 * Splits text by explicit newlines and wraps lines according to maxWidth
 */
export function getWrappedLines(
  ctx: CanvasRenderingContext,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      allLines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + ' ' + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width <= maxWidth) {
        currentLine = testLine;
      } else {
        allLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      allLines.push(currentLine);
    }
  }

  return allLines;
}

export interface QuestionTimingInfo {
  index: number;
  startTime: number;
  readingDuration: number;
  countdownStart: number;
  countdownDuration: number;
  revealStart: number;
  revealDuration: number;
  totalDuration: number;
}

/**
 * Returns exact sequenced timeline markers for each question:
 * Phase 1: startTime -> countdownStart (Reading Phase: voice speaks, timer steady)
 * Phase 2: countdownStart -> revealStart (Countdown Phase: voice over, timer ticks 4..3..2..1)
 * Phase 3: revealStart -> revealStart + revealDuration (Reveal Phase: answer revealed, fanfare, reveal speech)
 */
export function getQuizQuestionsTiming(quiz: QuizConfig): QuestionTimingInfo[] {
  const result: QuestionTimingInfo[] = [];
  let tAcc = 0;
  const total = quiz.questions?.length || 0;
  for (let i = 0; i < total; i++) {
    const q = quiz.questions[i];
    const qReading = q.readingDuration ?? quiz.readingDuration ?? 4.5;
    const countdownStart = tAcc + qReading;
    const revealStart = countdownStart + quiz.countdownDuration;
    const qTotal = qReading + quiz.countdownDuration + quiz.revealDuration;
    result.push({
      index: i,
      startTime: tAcc,
      readingDuration: qReading,
      countdownStart,
      countdownDuration: quiz.countdownDuration,
      revealStart,
      revealDuration: quiz.revealDuration,
      totalDuration: qTotal,
    });
    tAcc += qTotal;
  }
  return result;
}

/**
 * Helper to calculate total quiz duration considering:
 * Phase 1: Question & Options reading (voice reads question and options)
 * Phase 2: Countdown Timer (voice is over -> countdown begins and ticks)
 * Phase 3: Answer Reveal & Announcement
 */
export function calculateQuizTotalDuration(quiz: QuizConfig): number {
  const timings = getQuizQuestionsTiming(quiz);
  let total = 0;
  if (timings.length > 0) {
    const last = timings[timings.length - 1];
    total = last.startTime + last.totalDuration;
  }
  total += quiz.finalScreenDuration;
  return total;
}

/**
 * Deterministically renders a quiz frame at currentTime.
 * Supports tailored layout for YouTube Shorts (9:16 vertical) and Normal Video (16:9 2x2 grid).
 * Sequenced Timing: Reading Phase (Voice speaks) -> Countdown Timer (Voice over) -> Reveal Answer.
 */
export function renderQuizFrame(
  ctx: CanvasRenderingContext,
  quiz: QuizConfig,
  currentTime: number,
  width: number,
  height: number
) {
  const theme = QUIZ_THEMES[quiz.theme] || QUIZ_THEMES['neon-cyber'];
  const isPortrait = height > width;

  // Scale factor relative to 720x1280 base portrait or 1280x720 base landscape
  const baseDim = isPortrait ? 720 : 1280;
  const scale = width / baseDim;

  // 1. Background Gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, theme.bgGradient[0]);
  grad.addColorStop(0.5, theme.bgGradient[1]);
  grad.addColorStop(1, theme.bgGradient[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle background glow circles
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = theme.accentColor;
  ctx.beginPath();
  ctx.arc(width * 0.2, height * 0.2, 220 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.accentSecondary;
  ctx.beginPath();
  ctx.arc(width * 0.8, height * 0.75, 260 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Calculate timeline state with Sequenced Timing
  let questionStartTime = 0;
  let activeQuestionIndex = -1;
  let isReadingPhase = false;
  let isRevealPhase = false;
  let questionPhaseTime = 0; // seconds into this question
  let isFinalScreen = false;
  let finalScreenTime = 0;
  let currentQReadingDuration = 4.5;

  const totalQuestions = quiz.questions?.length || 0;

  if (totalQuestions === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(20 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('No Questions Available', width / 2, height / 2);
    return;
  }

  for (let i = 0; i < totalQuestions; i++) {
    const q = quiz.questions[i];
    const qReading = q.readingDuration ?? quiz.readingDuration ?? 4.5;
    const qDuration = qReading + quiz.countdownDuration + quiz.revealDuration;

    if (currentTime >= questionStartTime && currentTime < questionStartTime + qDuration) {
      activeQuestionIndex = i;
      questionPhaseTime = currentTime - questionStartTime;
      currentQReadingDuration = qReading;
      isReadingPhase = questionPhaseTime < qReading;
      isRevealPhase = questionPhaseTime >= qReading + quiz.countdownDuration;
      break;
    }
    questionStartTime += qDuration;
  }

  if (activeQuestionIndex === -1 && currentTime >= questionStartTime) {
    isFinalScreen = true;
    finalScreenTime = currentTime - questionStartTime;
  }

  // Draw Header / Title bar
  const padX = isPortrait ? 36 * scale : 50 * scale;
  const padTop = isPortrait ? 48 * scale : 32 * scale;

  ctx.save();
  ctx.fillStyle = theme.textSecondary;
  ctx.font = `800 ${Math.round((isPortrait ? 17 : 16) * scale)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText((quiz.title || 'AUORTA LEARNING QUIZ CHALLENGE').toUpperCase(), padX, padTop);

  // Total Progress Line
  const totalDuration = calculateQuizTotalDuration(quiz);
  const progressRatio = totalDuration > 0 ? Math.min(1, Math.max(0, currentTime / totalDuration)) : 0;
  const barW = width - padX * 2;
  const barH = 6 * scale;
  const barY = padTop + (isPortrait ? 30 * scale : 26 * scale);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  drawRoundedRect(ctx, padX, barY, barW, barH, 3 * scale);
  ctx.fill();

  ctx.fillStyle = theme.accentColor;
  drawRoundedRect(ctx, padX, barY, Math.max(8 * scale, barW * progressRatio), barH, 3 * scale);
  ctx.fill();
  ctx.restore();

  // --- FINAL SCREEN ---
  if (isFinalScreen) {
    renderFinalScreen(ctx, quiz, theme, finalScreenTime, width, height, scale, isPortrait);
    return;
  }

  // --- ACTIVE QUESTION SCREEN ---
  if (activeQuestionIndex >= 0 && activeQuestionIndex < totalQuestions) {
    const question = quiz.questions[activeQuestionIndex];

    // Sequenced Timer calculation:
    // If reading phase: voice is reading options -> Timer holds full steady (not ticking yet!)
    // If voice is over: Timer counts down!
    // If reveal phase: Timer is 0, answer revealed!
    let countdownRemaining = quiz.countdownDuration;
    let countdownProgress = 0;

    if (isReadingPhase) {
      countdownRemaining = quiz.countdownDuration;
      countdownProgress = 0;
    } else if (isRevealPhase) {
      countdownRemaining = 0;
      countdownProgress = 1;
    } else {
      const timeIntoTimer = questionPhaseTime - currentQReadingDuration;
      countdownRemaining = Math.max(0, quiz.countdownDuration - timeIntoTimer);
      countdownProgress = Math.min(1, timeIntoTimer / quiz.countdownDuration);
    }

    if (isPortrait) {
      renderShortsQuestionLayout(
        ctx,
        quiz,
        question,
        activeQuestionIndex,
        totalQuestions,
        countdownRemaining,
        countdownProgress,
        isRevealPhase,
        isReadingPhase,
        theme,
        width,
        height,
        scale,
        padX,
        barY + 18 * scale
      );
    } else {
      renderNormalQuestionLayout(
        ctx,
        quiz,
        question,
        activeQuestionIndex,
        totalQuestions,
        countdownRemaining,
        countdownProgress,
        isRevealPhase,
        isReadingPhase,
        theme,
        width,
        height,
        scale,
        padX,
        barY + 16 * scale
      );
    }
  }
}

/**
 * 1. YOUTUBE SHORTS QUESTION LAYOUT (9:16 Vertical)
 */
function renderShortsQuestionLayout(
  ctx: CanvasRenderingContext,
  quiz: QuizConfig,
  question: QuizQuestion,
  qIndex: number,
  totalQuestions: number,
  countdownRemaining: number,
  countdownProgress: number,
  isRevealPhase: boolean,
  isReadingPhase: boolean,
  theme: any,
  width: number,
  height: number,
  scale: number,
  padX: number,
  topY: number
) {
  // Top bar: Question indicator pill
  ctx.save();
  const pillW = 164 * scale;
  const pillH = 36 * scale;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  drawRoundedRect(ctx, padX, topY, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.fillStyle = theme.accentColor;
  ctx.font = `800 ${Math.round(15 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`QUESTION ${qIndex + 1} OF ${totalQuestions}`, padX + pillW / 2, topY + pillH / 2);
  ctx.restore();

  // Circular Countdown Timer (Holds during reading; counts down when voice finishes)
  const timerRadius = 42 * scale;
  const timerCenterX = width - padX - timerRadius;
  const timerCenterY = topY + timerRadius - 6 * scale;

  renderTimerCircle(
    ctx,
    timerCenterX,
    timerCenterY,
    timerRadius,
    countdownRemaining,
    countdownProgress,
    isRevealPhase,
    isReadingPhase,
    theme,
    scale
  );

  // Measure content for dynamic question card
  const cardW = width - padX * 2;
  const cardY = topY + 80 * scale;
  const padInnerX = 24 * scale;
  const contentW = cardW - padInnerX * 2;

  const hasStatements = Boolean(question.statements && question.statements.length > 0);
  const statements = question.statements || [];

  const qFontSize = hasStatements ? Math.round(20 * scale) : Math.round(23 * scale);
  const qLineHeight = Math.round((hasStatements ? 28 : 32) * scale);
  ctx.font = `800 ${qFontSize}px sans-serif`;
  const qPromptLines = getWrappedLines(ctx, question.question || 'Question', contentW);

  const categoryH = question.category ? 26 * scale : 0;

  const stmtFontSize = Math.round(17 * scale);
  const stmtLineHeight = Math.round(24 * scale);
  ctx.font = `600 ${stmtFontSize}px sans-serif`;

  const measuredStatements: { text: string; lines: string[] }[] = [];
  let stmtsTotalH = 0;
  if (hasStatements) {
    statements.forEach((st) => {
      const stLines = getWrappedLines(ctx, st, contentW - 16 * scale);
      measuredStatements.push({ text: st, lines: stLines });
      stmtsTotalH += Math.max(34 * scale, stLines.length * stmtLineHeight + 12 * scale);
    });
  }

  let footerLines: string[] = [];
  let footerH = 0;
  if (question.questionFooter) {
    ctx.font = `700 ${Math.round(18 * scale)}px sans-serif`;
    footerLines = getWrappedLines(ctx, question.questionFooter, contentW);
    footerH = footerLines.length * Math.round(26 * scale) + 10 * scale;
  }

  const promptH = qPromptLines.length * qLineHeight;
  const contentGap = 10 * scale;
  const cardH = Math.max(
    145 * scale,
    28 * scale + categoryH + promptH + (hasStatements ? stmtsTotalH + contentGap : 0) + footerH + 24 * scale
  );

  // Draw Question Card
  ctx.save();
  ctx.fillStyle = theme.cardBg;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 20 * scale;
  ctx.shadowOffsetY = 10 * scale;
  drawRoundedRect(ctx, padX, cardY, cardW, cardH, 20 * scale);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = hasStatements ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.18)';
  drawRoundedRect(ctx, padX, cardY, cardW, cardH, 20 * scale);
  ctx.stroke();

  let curY = cardY + 20 * scale;

  if (question.category) {
    ctx.fillStyle = theme.accentSecondary;
    ctx.font = `800 ${Math.round(12 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(question.category.toUpperCase(), padX + cardW / 2, curY);
    curY += categoryH;
  }

  ctx.fillStyle = theme.textPrimary;
  ctx.font = `800 ${qFontSize}px sans-serif`;
  ctx.textAlign = hasStatements ? 'left' : 'center';
  ctx.textBaseline = 'top';

  qPromptLines.forEach((line, i) => {
    const lineX = hasStatements ? padX + padInnerX : padX + cardW / 2;
    ctx.fillText(line, lineX, curY + i * qLineHeight);
  });
  curY += promptH + 8 * scale;

  if (hasStatements) {
    measuredStatements.forEach((stmtObj) => {
      const boxH = Math.max(34 * scale, stmtObj.lines.length * stmtLineHeight + 12 * scale);
      const boxX = padX + padInnerX;
      const boxW = contentW;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      drawRoundedRect(ctx, boxX, curY, boxW, boxH, 8 * scale);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1 * scale;
      drawRoundedRect(ctx, boxX, curY, boxW, boxH, 8 * scale);
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = `600 ${stmtFontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      stmtObj.lines.forEach((sLine, sIdx) => {
        ctx.fillText(sLine, boxX + 12 * scale, curY + 6 * scale + sIdx * stmtLineHeight);
      });

      curY += boxH + 6 * scale;
    });
  }

  if (footerLines.length > 0) {
    curY += 4 * scale;
    ctx.fillStyle = theme.accentColor;
    ctx.font = `700 ${Math.round(18 * scale)}px sans-serif`;
    ctx.textAlign = hasStatements ? 'left' : 'center';
    ctx.textBaseline = 'top';
    footerLines.forEach((fLine, fIdx) => {
      const fLineX = hasStatements ? padX + padInnerX : padX + cardW / 2;
      ctx.fillText(fLine, fLineX, curY + fIdx * Math.round(26 * scale));
    });
  }
  ctx.restore();

  // 4 Option Cards (Stacked for Shorts)
  const letters = ['A', 'B', 'C', 'D'];
  const optSpacing = hasStatements ? 12 * scale : 15 * scale;
  const optH = hasStatements ? 66 * scale : 72 * scale;
  const optStartY = cardY + cardH + (hasStatements ? 16 * scale : 24 * scale);

  question.options.forEach((optText, index) => {
    const isCorrect = index === question.correctIndex;
    const optY = optStartY + index * (optH + optSpacing);
    renderOptionButton(ctx, letters[index], optText, padX, optY, cardW, optH, isRevealPhase, isCorrect, theme, scale);
  });

  // Solution / Fact banner during reveal phase
  if (isRevealPhase && question.explanation) {
    const explainY = optStartY + 4 * (optH + optSpacing) + 14 * scale;
    renderExplanationBanner(
      ctx,
      question.explanation,
      question.explanationLabel,
      question.category,
      padX,
      explainY,
      cardW,
      theme,
      scale,
      true
    );
  }

  renderPromoTicker(ctx, quiz, width, height, scale, true);
}

/**
 * 2. NORMAL VIDEO QUESTION LAYOUT (16:9 Horizontal)
 */
function renderNormalQuestionLayout(
  ctx: CanvasRenderingContext,
  quiz: QuizConfig,
  question: QuizQuestion,
  qIndex: number,
  totalQuestions: number,
  countdownRemaining: number,
  countdownProgress: number,
  isRevealPhase: boolean,
  isReadingPhase: boolean,
  theme: any,
  width: number,
  height: number,
  scale: number,
  padX: number,
  topY: number
) {
  ctx.save();
  const pillW = 154 * scale;
  const pillH = 32 * scale;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  drawRoundedRect(ctx, padX, topY, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.fillStyle = theme.accentColor;
  ctx.font = `800 ${Math.round(14 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`QUESTION ${qIndex + 1} OF ${totalQuestions}`, padX + pillW / 2, topY + pillH / 2);
  ctx.restore();

  if (question.category) {
    ctx.save();
    ctx.fillStyle = theme.accentSecondary;
    ctx.font = `700 ${Math.round(13 * scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`CATEGORY: ${question.category.toUpperCase()}`, padX + pillW + 18 * scale, topY + pillH / 2);
    ctx.restore();
  }

  // Timer Circle on top right
  const timerRadius = 35 * scale;
  const timerCenterX = width - padX - timerRadius;
  const timerCenterY = topY + timerRadius - 8 * scale;
  renderTimerCircle(
    ctx,
    timerCenterX,
    timerCenterY,
    timerRadius,
    countdownRemaining,
    countdownProgress,
    isRevealPhase,
    isReadingPhase,
    theme,
    scale
  );

  const cardW = width - padX * 2;
  const cardY = topY + 62 * scale;
  const padInnerX = 26 * scale;
  const contentW = cardW - padInnerX * 2;

  const hasStatements = Boolean(question.statements && question.statements.length > 0);
  const statements = question.statements || [];

  const qFontSize = hasStatements ? Math.round(20 * scale) : Math.round(22 * scale);
  const qLineHeight = Math.round((hasStatements ? 27 : 29) * scale);
  ctx.font = `800 ${qFontSize}px sans-serif`;
  const qPromptLines = getWrappedLines(ctx, question.question || 'Question', contentW);

  const stmtFontSize = Math.round(16 * scale);
  const stmtLineHeight = Math.round(23 * scale);
  ctx.font = `600 ${stmtFontSize}px sans-serif`;

  const measuredStatements: { text: string; lines: string[] }[] = [];
  let stmtsTotalH = 0;
  if (hasStatements) {
    statements.forEach((st) => {
      const stLines = getWrappedLines(ctx, st, contentW - 16 * scale);
      measuredStatements.push({ text: st, lines: stLines });
      stmtsTotalH += Math.max(30 * scale, stLines.length * stmtLineHeight + 10 * scale);
    });
  }

  let footerLines: string[] = [];
  let footerH = 0;
  if (question.questionFooter) {
    ctx.font = `700 ${Math.round(17 * scale)}px sans-serif`;
    footerLines = getWrappedLines(ctx, question.questionFooter, contentW);
    footerH = footerLines.length * Math.round(24 * scale) + 8 * scale;
  }

  const promptH = qPromptLines.length * qLineHeight;
  const cardH = Math.max(
    115 * scale,
    22 * scale + promptH + (hasStatements ? stmtsTotalH + 8 * scale : 0) + footerH + 18 * scale
  );

  ctx.save();
  ctx.fillStyle = theme.cardBg;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 18 * scale;
  ctx.shadowOffsetY = 8 * scale;
  drawRoundedRect(ctx, padX, cardY, cardW, cardH, 18 * scale);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = hasStatements ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.16)';
  drawRoundedRect(ctx, padX, cardY, cardW, cardH, 18 * scale);
  ctx.stroke();

  let curY = cardY + 16 * scale;

  ctx.fillStyle = theme.textPrimary;
  ctx.font = `800 ${qFontSize}px sans-serif`;
  ctx.textAlign = hasStatements ? 'left' : 'center';
  ctx.textBaseline = 'top';

  qPromptLines.forEach((line, i) => {
    const lineX = hasStatements ? padX + padInnerX : padX + cardW / 2;
    ctx.fillText(line, lineX, curY + i * qLineHeight);
  });
  curY += promptH + 6 * scale;

  if (hasStatements) {
    measuredStatements.forEach((stmtObj) => {
      const boxH = Math.max(28 * scale, stmtObj.lines.length * stmtLineHeight + 8 * scale);
      const boxX = padX + padInnerX;
      const boxW = contentW;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      drawRoundedRect(ctx, boxX, curY, boxW, boxH, 6 * scale);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1 * scale;
      drawRoundedRect(ctx, boxX, curY, boxW, boxH, 6 * scale);
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = `600 ${stmtFontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      stmtObj.lines.forEach((sLine, sIdx) => {
        ctx.fillText(sLine, boxX + 10 * scale, curY + 4 * scale + sIdx * stmtLineHeight);
      });

      curY += boxH + 5 * scale;
    });
  }

  if (footerLines.length > 0) {
    curY += 2 * scale;
    ctx.fillStyle = theme.accentColor;
    ctx.font = `700 ${Math.round(17 * scale)}px sans-serif`;
    ctx.textAlign = hasStatements ? 'left' : 'center';
    ctx.textBaseline = 'top';
    footerLines.forEach((fLine, fIdx) => {
      const fLineX = hasStatements ? padX + padInnerX : padX + cardW / 2;
      ctx.fillText(fLine, fLineX, curY + fIdx * Math.round(24 * scale));
    });
  }
  ctx.restore();

  // 2x2 OPTIONS GRID
  const letters = ['A', 'B', 'C', 'D'];
  const gridGapX = 24 * scale;
  const gridGapY = 14 * scale;
  const optW = (cardW - gridGapX) / 2;
  const optH = 64 * scale;
  const optGridStartY = cardY + cardH + 16 * scale;

  renderOptionButton(ctx, letters[0], question.options[0], padX, optGridStartY, optW, optH, isRevealPhase, question.correctIndex === 0, theme, scale);
  renderOptionButton(ctx, letters[1], question.options[1], padX + optW + gridGapX, optGridStartY, optW, optH, isRevealPhase, question.correctIndex === 1, theme, scale);
  renderOptionButton(ctx, letters[2], question.options[2], padX, optGridStartY + optH + gridGapY, optW, optH, isRevealPhase, question.correctIndex === 2, theme, scale);
  renderOptionButton(ctx, letters[3], question.options[3], padX + optW + gridGapX, optGridStartY + optH + gridGapY, optW, optH, isRevealPhase, question.correctIndex === 3, theme, scale);

  if (isRevealPhase && question.explanation) {
    const explainY = optGridStartY + (optH * 2) + gridGapY + 12 * scale;
    renderExplanationBanner(
      ctx,
      question.explanation,
      question.explanationLabel,
      question.category,
      padX,
      explainY,
      cardW,
      theme,
      scale,
      false
    );
  }

  renderPromoTicker(ctx, quiz, width, height, scale, false);
}

/**
 * Timer arc helper:
 * - isReadingPhase: voice is speaking question & options; shows full steady timer number with "LISTEN / ശ്രദ്ധിക്കുക"
 * - !isReadingPhase: voice is over; timer counts down with ticks (5... 4... 3... 2... 1...)
 * - isRevealPhase: shows green checkmark
 */
function renderTimerCircle(
  ctx: CanvasRenderingContext,
  cx: number,
  cy: number,
  r: number,
  countdownRemaining: number,
  countdownProgress: number,
  isRevealPhase: boolean,
  isReadingPhase: boolean,
  theme: any,
  scale: number
) {
  ctx.save();

  if (isReadingPhase) {
    // 1. Reading Phase: Voice is reading options. Countdown holds steady!
    ctx.lineWidth = 5 * scale;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)'; // Sky blue reading indicator
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = theme.textPrimary;
    ctx.font = `800 ${Math.round(23 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(countdownRemaining)}`, cx, cy - 5 * scale);

    ctx.fillStyle = '#38bdf8';
    ctx.font = `800 ${Math.round(9 * scale)}px sans-serif`;
    ctx.fillText('LISTEN', cx, cy + 13 * scale);
  } else if (!isRevealPhase) {
    // 2. Countdown Phase: Voice is over. The timer begins counting down!
    ctx.lineWidth = 6 * scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const sweep = (1 - countdownProgress) * Math.PI * 2;
    ctx.strokeStyle = countdownRemaining <= 1.2 ? theme.accentSecondary : theme.accentColor;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + sweep);
    ctx.stroke();

    ctx.fillStyle = theme.textPrimary;
    ctx.font = `800 ${Math.round(25 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(countdownRemaining)}`, cx, cy);
  } else {
    // 3. Reveal Phase: Answer highlighted
    ctx.fillStyle = theme.correctBorder;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(23 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', cx, cy);
  }
  ctx.restore();
}

// Option button renderer
function renderOptionButton(
  ctx: CanvasRenderingContext,
  letter: string,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  isRevealPhase: boolean,
  isCorrect: boolean,
  theme: any,
  scale: number
) {
  ctx.save();
  let bg = 'rgba(255, 255, 255, 0.08)';
  let border = 'rgba(255, 255, 255, 0.16)';
  let textColor = theme.textPrimary;
  let badgeBg = 'rgba(255, 255, 255, 0.15)';
  let badgeText = '#ffffff';

  if (isRevealPhase) {
    if (isCorrect) {
      bg = theme.correctBg;
      border = theme.correctBorder;
      textColor = theme.correctText;
      badgeBg = theme.correctBorder;
      badgeText = '#042f1a';
    } else {
      bg = theme.wrongBg;
      border = 'rgba(239, 68, 68, 0.3)';
      textColor = 'rgba(255, 255, 255, 0.5)';
      badgeBg = 'rgba(239, 68, 68, 0.2)';
      badgeText = 'rgba(255, 255, 255, 0.6)';
    }
  }

  // Body
  ctx.fillStyle = bg;
  drawRoundedRect(ctx, x, y, w, h, 16 * scale);
  ctx.fill();

  // Border
  ctx.lineWidth = isRevealPhase && isCorrect ? 3 * scale : 1.5 * scale;
  ctx.strokeStyle = border;
  drawRoundedRect(ctx, x, y, w, h, 16 * scale);
  ctx.stroke();

  // Letter badge circle
  const badgeR = h * 0.28;
  const badgeX = x + 18 * scale + badgeR;
  const badgeY = y + h / 2;

  ctx.fillStyle = badgeBg;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = badgeText;
  ctx.font = `800 ${Math.round(18 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, badgeX, badgeY);

  // Option text
  ctx.fillStyle = textColor;
  ctx.font = `700 ${Math.round(17 * scale)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const maxOptTextW = w - (badgeX - x + badgeR + 42 * scale);
  ctx.fillText(text, badgeX + badgeR + 14 * scale, badgeY, maxOptTextW);

  // Status icon during reveal
  if (isRevealPhase) {
    const rightX = x + w - 24 * scale;
    ctx.textAlign = 'center';
    if (isCorrect) {
      ctx.fillStyle = theme.correctBorder;
      ctx.font = `800 ${Math.round(22 * scale)}px sans-serif`;
      ctx.fillText('✓', rightX, badgeY);
    } else {
      ctx.fillStyle = theme.wrongBorder;
      ctx.font = `800 ${Math.round(18 * scale)}px sans-serif`;
      ctx.fillText('✕', rightX, badgeY);
    }
  }
  ctx.restore();
}

/**
 * Multi-line Solution / Fact / Explanation Card renderer
 */
function renderExplanationBanner(
  ctx: CanvasRenderingContext,
  text: string,
  customLabel: string | undefined,
  category: string | undefined,
  x: number,
  y: number,
  w: number,
  theme: any,
  scale: number,
  isPortrait: boolean
) {
  ctx.save();

  let labelText = customLabel?.trim();
  let icon = '💡';
  if (!labelText) {
    const catLower = (category || '').toLowerCase();
    if (catLower.includes('math') || catLower.includes('calc') || catLower.includes('aptitude') || catLower.includes('കണക്ക്')) {
      labelText = 'SOLUTION';
      icon = '📐';
    } else {
      labelText = 'KEY FACT';
      icon = '💡';
    }
  } else {
    const lower = labelText.toLowerCase();
    if (lower.includes('solution') || lower.includes('step') || lower.includes('പരിഹാരം') || lower.includes('math')) {
      icon = '📐';
    } else if (lower.includes('fact')) {
      icon = '💡';
    } else {
      icon = '📝';
    }
    labelText = labelText.toUpperCase();
  }

  const fontSize = Math.round((isPortrait ? 17 : 16) * scale);
  const lineHeight = Math.round((isPortrait ? 25 : 23) * scale);
  const padInnerX = 22 * scale;
  const maxTextW = w - padInnerX * 2;

  ctx.font = `600 ${fontSize}px sans-serif`;
  const lines = getWrappedLines(ctx, text, maxTextW);

  const badgeH = 26 * scale;
  const textH = Math.max(lineHeight, lines.length * lineHeight);
  const totalH = 14 * scale + badgeH + 8 * scale + textH + 16 * scale;

  ctx.fillStyle = 'rgba(10, 15, 30, 0.95)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 22 * scale;
  ctx.shadowOffsetY = 8 * scale;
  drawRoundedRect(ctx, x, y, w, totalH, 18 * scale);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.8 * scale;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  drawRoundedRect(ctx, x, y, w, totalH, 18 * scale);
  ctx.stroke();

  ctx.font = `800 ${Math.round(12 * scale)}px sans-serif`;
  const badgeTextStr = `${icon} ${labelText}`;
  const badgeTextMetrics = ctx.measureText(badgeTextStr);
  const badgeW = Math.max(140 * scale, badgeTextMetrics.width + 24 * scale);
  const badgeX = x + padInnerX;
  const badgeY = y + 14 * scale;

  ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeTextStr, badgeX + badgeW / 2, badgeY + badgeH / 2);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const textStartY = badgeY + badgeH + 10 * scale;
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padInnerX, textStartY + i * lineHeight);
  });

  ctx.restore();
}

/**
 * Bottom Promotional Ticker (Auorta Learning App)
 */
function renderPromoTicker(
  ctx: CanvasRenderingContext,
  quiz: QuizConfig,
  width: number,
  height: number,
  scale: number,
  isPortrait: boolean
) {
  const promo = quiz.promo;
  if (promo && promo.enabled === false) return;
  if (promo && promo.showTicker === false) return;

  const appName = promo?.appName || 'Auorta Learning App';
  const tickerText =
    promo?.tickerText ||
    'Download Auorta Learning App on Google Play for Mock Tests & Previous Year Questions';

  const tickerH = (isPortrait ? 44 : 38) * scale;
  const padX = (isPortrait ? 24 : 50) * scale;
  const tickerY = height - tickerH - (isPortrait ? 26 : 14) * scale;
  const tickerW = width - padX * 2;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  drawRoundedRect(ctx, padX, tickerY, tickerW, tickerH, tickerH / 2);
  ctx.fill();

  ctx.lineWidth = 1.5 * scale;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  drawRoundedRect(ctx, padX, tickerY, tickerW, tickerH, tickerH / 2);
  ctx.stroke();

  const tagW = (isPortrait ? 94 : 104) * scale;
  ctx.fillStyle = '#0284c7';
  drawRoundedRect(ctx, padX + 3 * scale, tickerY + 3 * scale, tagW, tickerH - 6 * scale, (tickerH - 6 * scale) / 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(11 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▶ PLAY STORE', padX + 3 * scale + tagW / 2, tickerY + tickerH / 2);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 ${Math.round((isPortrait ? 13 : 13) * scale)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${appName} • ${tickerText.replace(appName, '').replace(/^[\s•]+/, '')}`,
    padX + tagW + 14 * scale,
    tickerY + tickerH / 2,
    tickerW - tagW - 24 * scale
  );
  ctx.restore();
}

/**
 * Authentically styled "GET IT ON Google Play" badge
 */
function drawGooglePlayBadge(
  ctx: CanvasRenderingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number
) {
  ctx.save();
  ctx.fillStyle = '#050814';
  drawRoundedRect(ctx, x, y, w, h, 12 * scale);
  ctx.fill();

  ctx.lineWidth = 1.5 * scale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  drawRoundedRect(ctx, x, y, w, h, 12 * scale);
  ctx.stroke();

  const iconSize = 24 * scale;
  const iconX = x + 18 * scale;
  const iconY = y + (h - iconSize) / 2;

  ctx.beginPath();
  ctx.moveTo(iconX, iconY);
  ctx.lineTo(iconX + iconSize * 0.9, iconY + iconSize / 2);
  ctx.lineTo(iconX, iconY + iconSize);
  ctx.closePath();
  ctx.fillStyle = '#34d399';
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = `700 ${Math.round(10 * scale)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('GET IT ON', iconX + iconSize + 12 * scale, iconY + 1 * scale);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(16 * scale)}px sans-serif`;
  ctx.fillText('Google Play', iconX + iconSize + 12 * scale, iconY + 12 * scale);
  ctx.restore();
}

/**
 * FINAL SCREEN (Results + Auorta App Promotion Spotlight)
 */
function renderFinalScreen(
  ctx: CanvasRenderingContext,
  quiz: QuizConfig,
  theme: any,
  screenTime: number,
  width: number,
  height: number,
  scale: number,
  isPortrait: boolean
) {
  const padX = isPortrait ? 36 * scale : 60 * scale;
  const centerY = height * (isPortrait ? 0.38 : 0.44);

  renderConfetti(ctx, width, height, screenTime, scale);
  renderTrophy(ctx, width / 2, centerY - (isPortrait ? 120 : 90) * scale, theme, scale);

  ctx.save();
  ctx.fillStyle = theme.textPrimary;
  ctx.font = `900 ${Math.round((isPortrait ? 34 : 36) * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CHALLENGE COMPLETE!', width / 2, centerY - (isPortrait ? 25 : 15) * scale);

  ctx.fillStyle = theme.textSecondary;
  ctx.font = `700 ${Math.round((isPortrait ? 18 : 19) * scale)}px sans-serif`;
  ctx.fillText(`Tested on ${quiz.questions.length} Questions`, width / 2, centerY + (isPortrait ? 16 : 20) * scale);
  ctx.restore();

  const promo = quiz.promo;
  if (promo && promo.enabled !== false && promo.showInFinalScreen !== false) {
    const cardW = width - padX * 2;
    const cardH = isPortrait ? 220 * scale : 155 * scale;
    const cardY = height - cardH - (isPortrait ? 50 : 36) * scale;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 24 * scale;
    ctx.shadowOffsetY = 10 * scale;
    drawRoundedRect(ctx, padX, cardY, cardW, cardH, 22 * scale);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2 * scale;
    const borderGrad = ctx.createLinearGradient(padX, cardY, padX + cardW, cardY + cardH);
    borderGrad.addColorStop(0, '#0284c7');
    borderGrad.addColorStop(1, '#10b981');
    ctx.strokeStyle = borderGrad;
    drawRoundedRect(ctx, padX, cardY, cardW, cardH, 22 * scale);
    ctx.stroke();

    const iconSize = isPortrait ? 60 * scale : 56 * scale;
    const iconX = padX + 24 * scale;
    const iconY = cardY + 22 * scale;

    ctx.fillStyle = 'linear-gradient(135deg, #0284c7, #38bdf8)';
    drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 14 * scale);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(30 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', iconX + iconSize / 2, iconY + iconSize / 2);

    const textStartX = iconX + iconSize + 18 * scale;
    const textMaxW = cardW - (textStartX - padX) - 24 * scale;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#38bdf8';
    ctx.font = `800 ${Math.round(14 * scale)}px sans-serif`;
    ctx.fillText((promo.appName || 'AUORTA LEARNING APP').toUpperCase(), textStartX, iconY);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round((isPortrait ? 18 : 19) * scale)}px sans-serif`;
    ctx.fillText(promo.headline || 'Download Auorta Learning App', textStartX, iconY + 18 * scale, textMaxW);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 ${Math.round((isPortrait ? 13 : 14) * scale)}px sans-serif`;
    const descLines = getWrappedLines(
      ctx,
      promo.description || 'Full-Length Mock Tests & Solved Previous Year Questions. Available on Google Play!',
      textMaxW
    );
    descLines.slice(0, 2).forEach((dLine, dIdx) => {
      ctx.fillText(dLine, textStartX, iconY + (isPortrait ? 42 : 44) * scale + dIdx * 18 * scale);
    });

    const badgeW = 210 * scale;
    const badgeH = 52 * scale;
    drawGooglePlayBadge(ctx, iconX, cardY + cardH - badgeH - 18 * scale, badgeW, badgeH, scale);
    ctx.restore();
  }
}

function renderTrophy(
  ctx: CanvasRenderingContext,
  centerX: number,
  trophyY: number,
  theme: any,
  scale: number
) {
  ctx.save();
  ctx.fillStyle = theme.accentColor;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(centerX, trophyY, 80 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(centerX, trophyY - 10 * scale, 42 * scale, 0, Math.PI);
  ctx.fill();

  ctx.lineWidth = 5 * scale;
  ctx.strokeStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(centerX - 42 * scale, trophyY - 18 * scale, 16 * scale, Math.PI / 2, (Math.PI * 3) / 2, true);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX + 42 * scale, trophyY - 18 * scale, 16 * scale, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.stroke();

  ctx.fillRect(centerX - 10 * scale, trophyY + 32 * scale, 20 * scale, 24 * scale);
  drawRoundedRect(ctx, centerX - 32 * scale, trophyY + 54 * scale, 64 * scale, 12 * scale, 4 * scale);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(26 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', centerX, trophyY + 10 * scale);
  ctx.restore();
}

function renderConfetti(
  ctx: CanvasRenderingContext,
  width: number,
  height: number,
  t: number,
  scale: number
) {
  const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#e11d48'];
  const particleCount = 45;

  ctx.save();
  for (let i = 0; i < particleCount; i++) {
    const seed = i * 137.5;
    const speed = 120 + ((i * 37) % 180);
    const x = (Math.sin(seed + t * 0.8) * 0.45 + 0.5) * width;
    const y = ((t * speed + i * 28) % (height + 40)) - 20;
    const size = (6 + (i % 6)) * scale;

    ctx.fillStyle = colors[i % colors.length];
    ctx.save();
    ctx.fillRect(x, y, size, size * 0.6);
    ctx.restore();
  }
  ctx.restore();
}
