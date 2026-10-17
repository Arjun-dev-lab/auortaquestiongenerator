import { QuizConfig } from '../types/quiz';
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
 * Deterministically renders a quiz frame at currentTime.
 * Supports tailored layout for YouTube Shorts (9:16 vertical) and Normal Video (16:9 2x2 grid).
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

  // Calculate timeline state
  let questionStartTime = 0;
  let activeQuestionIndex = -1;
  let isRevealPhase = false;
  let questionPhaseTime = 0; // seconds into this question
  let isFinalScreen = false;
  let finalScreenTime = 0;

  for (let i = 0; i < quiz.questions.length; i++) {
    const qDuration = quiz.countdownDuration + quiz.revealDuration;
    if (currentTime >= questionStartTime && currentTime < questionStartTime + qDuration) {
      activeQuestionIndex = i;
      questionPhaseTime = currentTime - questionStartTime;
      isRevealPhase = questionPhaseTime >= quiz.countdownDuration;
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
  const padTop = isPortrait ? 52 * scale : 36 * scale;

  ctx.save();
  ctx.fillStyle = theme.textSecondary;
  ctx.font = `700 ${Math.round((isPortrait ? 18 : 17) * scale)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(quiz.title.toUpperCase(), padX, padTop);

  // Total Progress Line
  const totalDuration =
    quiz.questions.length * (quiz.countdownDuration + quiz.revealDuration) + quiz.finalScreenDuration;
  const progressRatio = Math.min(1, Math.max(0, currentTime / totalDuration));
  const barW = width - padX * 2;
  const barH = 6 * scale;
  const barY = padTop + (isPortrait ? 32 * scale : 28 * scale);

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
  if (activeQuestionIndex >= 0 && activeQuestionIndex < quiz.questions.length) {
    const question = quiz.questions[activeQuestionIndex];
    const countdownRemaining = Math.max(0, quiz.countdownDuration - questionPhaseTime);
    const countdownProgress = Math.min(1, questionPhaseTime / quiz.countdownDuration);

    if (isPortrait) {
      // YouTube Shorts Layout (9:16 Vertical)
      renderShortsQuestionLayout(
        ctx,
        quiz,
        question,
        activeQuestionIndex,
        quiz.questions.length,
        countdownRemaining,
        countdownProgress,
        isRevealPhase,
        theme,
        width,
        height,
        scale,
        padX,
        barY + 22 * scale
      );
    } else {
      // Normal Video Layout (16:9 Horizontal with 2x2 Options Grid)
      renderNormalQuestionLayout(
        ctx,
        quiz,
        question,
        activeQuestionIndex,
        quiz.questions.length,
        countdownRemaining,
        countdownProgress,
        isRevealPhase,
        theme,
        width,
        height,
        scale,
        padX,
        barY + 18 * scale
      );
    }
  }
}

/**
 * 1. YOUTUBE SHORTS QUESTION LAYOUT (9:16 Vertical)
 * Stacked options with safe zones for YouTube Shorts / Reels overlays.
 */
function renderShortsQuestionLayout(
  ctx: CanvasRenderingContext,
  quiz: QuizConfig,
  question: QuizConfig['questions'][0],
  qIndex: number,
  totalQuestions: number,
  countdownRemaining: number,
  countdownProgress: number,
  isRevealPhase: boolean,
  theme: any,
  width: number,
  height: number,
  scale: number,
  padX: number,
  topY: number
) {
  // Question indicator pill
  ctx.save();
  const pillW = 160 * scale;
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

  // Circular Countdown Timer
  const timerRadius = 44 * scale;
  const timerCenterX = width - padX - timerRadius;
  const timerCenterY = topY + timerRadius - 6 * scale;

  renderTimerCircle(ctx, timerCenterX, timerCenterY, timerRadius, countdownRemaining, countdownProgress, isRevealPhase, theme, scale);

  // Question Card Box
  const cardY = topY + 85 * scale;
  const cardW = width - padX * 2;
  const cardH = 175 * scale;

  ctx.save();
  ctx.fillStyle = theme.cardBg;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 20 * scale;
  ctx.shadowOffsetY = 10 * scale;
  drawRoundedRect(ctx, padX, cardY, cardW, cardH, 22 * scale);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  drawRoundedRect(ctx, padX, cardY, cardW, cardH, 22 * scale);
  ctx.stroke();

  // Category badge inside question card if provided
  if (question.category) {
    ctx.fillStyle = theme.accentSecondary;
    ctx.font = `700 ${Math.round(12 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(question.category.toUpperCase(), padX + cardW / 2, cardY + 24 * scale);
  }

  // Question text with word wrap
  ctx.fillStyle = theme.textPrimary;
  ctx.font = `800 ${Math.round(24 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textCenterY = question.category ? cardY + cardH / 2 + 10 * scale : cardY + cardH / 2;
  wrapText(ctx, question.question, padX + cardW / 2, textCenterY, cardW - 44 * scale, Math.round(33 * scale));
  ctx.restore();

  // 4 Option Cards (Stacked for Shorts)
  const letters = ['A', 'B', 'C', 'D'];
  const optSpacing = 16 * scale;
  const optH = 74 * scale;
  const optStartY = cardY + cardH + 26 * scale;

  question.options.forEach((optText, index) => {
    const isCorrect = index === question.correctIndex;
    const optY = optStartY + index * (optH + optSpacing);
    renderOptionButton(ctx, letters[index], optText, padX, optY, cardW, optH, isRevealPhase, isCorrect, theme, scale);
  });

  // Fun Fact / Explanation banner during reveal phase
  if (isRevealPhase && question.explanation) {
    const explainY = optStartY + 4 * (optH + optSpacing) + 16 * scale;
    renderExplanationBanner(ctx, question.explanation, padX, explainY, cardW, theme, scale, true);
  }

  // Bottom Auorta Learning App Promotion Ticker
  renderPromoTicker(ctx, quiz, width, height, scale, true);
}

/**
 * 2. NORMAL VIDEO QUESTION LAYOUT (16:9 Horizontal)
 * Uses a broadcast 2x2 Grid for the 4 Options!
 */
function renderNormalQuestionLayout(
  ctx: CanvasRenderingContext,
  quiz: QuizConfig,
  question: QuizConfig['questions'][0],
  qIndex: number,
  totalQuestions: number,
  countdownRemaining: number,
  countdownProgress: number,
  isRevealPhase: boolean,
  theme: any,
  width: number,
  height: number,
  scale: number,
  padX: number,
  topY: number
) {
  // Top bar: Question indicator pill
  ctx.save();
  const pillW = 150 * scale;
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

  // Category if present
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
  const timerRadius = 36 * scale;
  const timerCenterX = width - padX - timerRadius;
  const timerCenterY = topY + timerRadius - 8 * scale;
  renderTimerCircle(ctx, timerCenterX, timerCenterY, timerRadius, countdownRemaining, countdownProgress, isRevealPhase, theme, scale);

  // Question Card Box (Full Width, Centered)
  const cardY = topY + 68 * scale;
  const cardW = width - padX * 2;
  const cardH = 120 * scale;

  ctx.save();
  ctx.fillStyle = theme.cardBg;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 18 * scale;
  ctx.shadowOffsetY = 8 * scale;
  drawRoundedRect(ctx, padX, cardY, cardW, cardH, 20 * scale);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  drawRoundedRect(ctx, padX, cardY, cardW, cardH, 20 * scale);
  ctx.stroke();

  // Question Text
  ctx.fillStyle = theme.textPrimary;
  ctx.font = `800 ${Math.round(23 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  wrapText(ctx, question.question, padX + cardW / 2, cardY + cardH / 2, cardW - 50 * scale, Math.round(30 * scale));
  ctx.restore();

  // 2x2 OPTIONS GRID
  const letters = ['A', 'B', 'C', 'D'];
  const gridGapX = 24 * scale;
  const gridGapY = 16 * scale;
  const optW = (cardW - gridGapX) / 2;
  const optH = 68 * scale;
  const optGridStartY = cardY + cardH + 20 * scale;

  // Option A (Row 0, Col 0)
  renderOptionButton(ctx, letters[0], question.options[0], padX, optGridStartY, optW, optH, isRevealPhase, question.correctIndex === 0, theme, scale);
  // Option B (Row 0, Col 1)
  renderOptionButton(ctx, letters[1], question.options[1], padX + optW + gridGapX, optGridStartY, optW, optH, isRevealPhase, question.correctIndex === 1, theme, scale);
  // Option C (Row 1, Col 0)
  renderOptionButton(ctx, letters[2], question.options[2], padX, optGridStartY + optH + gridGapY, optW, optH, isRevealPhase, question.correctIndex === 2, theme, scale);
  // Option D (Row 1, Col 1)
  renderOptionButton(ctx, letters[3], question.options[3], padX + optW + gridGapX, optGridStartY + optH + gridGapY, optW, optH, isRevealPhase, question.correctIndex === 3, theme, scale);

  // Explanation Banner below 2x2 grid during reveal
  if (isRevealPhase && question.explanation) {
    const explainY = optGridStartY + (optH * 2) + gridGapY + 12 * scale;
    renderExplanationBanner(ctx, question.explanation, padX, explainY, cardW, theme, scale, false);
  }

  // Bottom Auorta Learning App Promotion Ticker
  renderPromoTicker(ctx, quiz, width, height, scale, false);
}

// Timer arc helper
function renderTimerCircle(
  ctx: CanvasRenderingContext,
  cx: number,
  cy: number,
  r: number,
  countdownRemaining: number,
  countdownProgress: number,
  isRevealPhase: boolean,
  theme: any,
  scale: number
) {
  ctx.save();
  ctx.lineWidth = 6 * scale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (!isRevealPhase) {
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
  const badgeX = x + 20 * scale + badgeR;
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
  ctx.font = `600 ${Math.round(18 * scale)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const maxOptTextW = w - (badgeX - x + badgeR + 40 * scale);
  ctx.fillText(text, badgeX + badgeR + 16 * scale, badgeY, maxOptTextW);

  // Status icon during reveal
  if (isRevealPhase) {
    const rightX = x + w - 28 * scale;
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

function getWrappedLines(
  ctx: CanvasRenderingContext,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// Multi-line Explanation / Fact Card renderer
function renderExplanationBanner(
  ctx: CanvasRenderingContext,
  text: string,
  x: number,
  y: number,
  w: number,
  theme: any,
  scale: number,
  isPortrait: boolean
) {
  ctx.save();
  const fontSize = Math.round((isPortrait ? 18 : 17) * scale);
  const lineHeight = Math.round((isPortrait ? 26 : 24) * scale);
  const padInnerX = 22 * scale;
  const maxTextW = w - padInnerX * 2;

  ctx.font = `600 ${fontSize}px sans-serif`;
  const lines = getWrappedLines(ctx, text, maxTextW);

  // Card dimensions based on lines of text
  const badgeH = 24 * scale;
  const textH = lines.length * lineHeight;
  const totalH = 16 * scale + badgeH + 10 * scale + textH + 14 * scale;

  // Glassmorphic Card Background with high contrast
  ctx.fillStyle = 'rgba(10, 15, 30, 0.94)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 20 * scale;
  ctx.shadowOffsetY = 8 * scale;
  drawRoundedRect(ctx, x, y, w, totalH, 18 * scale);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.8 * scale;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)'; // Vibrant cyan / sky accent glow
  drawRoundedRect(ctx, x, y, w, totalH, 18 * scale);
  ctx.stroke();

  // Header Badge: "💡 DID YOU KNOW?"
  const badgeW = 150 * scale;
  const badgeX = x + padInnerX;
  const badgeY = y + 14 * scale;

  ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = `800 ${Math.round(12 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💡 DID YOU KNOW?', badgeX + badgeW / 2, badgeY + badgeH / 2);

  // Render multi-line fact text with full, bold, high-contrast typography (NO horizontal squishing)
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

  const appName = promo?.appName || 'Auorta Learning App';
  const tickerText =
    promo?.tickerText ||
    'Download Auorta Learning App on Google Play for Mock Tests & Previous Year Questions';

  const tickerH = (isPortrait ? 44 : 38) * scale;
  const padX = (isPortrait ? 24 : 50) * scale;
  const tickerY = height - tickerH - (isPortrait ? 28 : 16) * scale;
  const tickerW = width - padX * 2;

  ctx.save();
  // Pill background with glass border
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  drawRoundedRect(ctx, padX, tickerY, tickerW, tickerH, tickerH / 2);
  ctx.fill();

  ctx.lineWidth = 1.5 * scale;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)'; // Sky glow
  drawRoundedRect(ctx, padX, tickerY, tickerW, tickerH, tickerH / 2);
  ctx.stroke();

  // Play icon tag on left
  const tagW = (isPortrait ? 90 : 100) * scale;
  ctx.fillStyle = '#0284c7';
  drawRoundedRect(ctx, padX + 3 * scale, tickerY + 3 * scale, tagW, tickerH - 6 * scale, (tickerH - 6 * scale) / 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(11 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▶ PLAY STORE', padX + 3 * scale + tagW / 2, tickerY + tickerH / 2);

  // Ticker text
  ctx.fillStyle = '#f8fafc';
  ctx.font = `600 ${Math.round((isPortrait ? 13 : 13) * scale)}px sans-serif`;
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
  // Rounded black pill
  ctx.fillStyle = '#050814';
  drawRoundedRect(ctx, x, y, w, h, 12 * scale);
  ctx.fill();

  ctx.lineWidth = 1.5 * scale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  drawRoundedRect(ctx, x, y, w, h, 12 * scale);
  ctx.stroke();

  // Play Store triangle icon
  const iconSize = 24 * scale;
  const iconX = x + 18 * scale;
  const iconY = y + (h - iconSize) / 2;

  ctx.beginPath();
  ctx.moveTo(iconX, iconY);
  ctx.lineTo(iconX + iconSize * 0.9, iconY + iconSize / 2);
  ctx.lineTo(iconX, iconY + iconSize);
  ctx.closePath();
  ctx.fillStyle = '#34d399'; // Vibrant emerald play icon
  ctx.fill();

  // Upper label: GET IT ON
  ctx.fillStyle = '#94a3b8';
  ctx.font = `700 ${Math.round(10 * scale)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('GET IT ON', iconX + iconSize + 12 * scale, iconY + 1 * scale);

  // Main brand: Google Play
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(16 * scale)}px sans-serif`;
  ctx.fillText('Google Play', iconX + iconSize + 12 * scale, iconY + 12 * scale);
  ctx.restore();
}

/**
 * 3. FINAL SCREEN
 * Features full celebration, score summary, and dedicated Auorta Learning App promotion card!
 */
function renderFinalScreen(
  ctx: CanvasRenderingContext,
  quiz: QuizConfig,
  theme: any,
  timeIntoFinal: number,
  width: number,
  height: number,
  scale: number,
  isPortrait: boolean
) {
  // Render animated confetti particles
  renderConfetti(ctx, width, height, timeIntoFinal, scale);

  const promo = quiz.promo;
  const appName = promo?.appName || 'Auorta Learning App';
  const headline = promo?.headline || 'Boost Your Exam Score with Auorta';
  const description =
    promo?.description || 'Access Full-Length Mock Tests & Solved Previous Year Questions (PYQs)';

  if (isPortrait) {
    // Shorts Vertical Final Screen
    const centerX = width / 2;

    // Trophy Graphic
    const trophyY = 180 * scale;
    renderTrophy(ctx, centerX, trophyY, theme, scale);

    // Headline
    ctx.save();
    ctx.fillStyle = theme.textPrimary;
    ctx.font = `900 ${Math.round(36 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QUIZ COMPLETED!', centerX, trophyY + 105 * scale);

    // Score Badge
    const scoreCardW = 270 * scale;
    const scoreCardH = 46 * scale;
    const scoreCardY = trophyY + 135 * scale;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    drawRoundedRect(ctx, centerX - scoreCardW / 2, scoreCardY, scoreCardW, scoreCardH, 23 * scale);
    ctx.fill();

    ctx.fillStyle = theme.accentColor;
    ctx.font = `800 ${Math.round(18 * scale)}px sans-serif`;
    ctx.fillText(`${quiz.questions.length} / ${quiz.questions.length} PERFECT SCORE`, centerX, scoreCardY + scoreCardH / 2);
    ctx.restore();

    // PROMOTIONAL CARD FOR AUORTA LEARNING APP
    const cardW = width - 64 * scale;
    const cardH = 340 * scale;
    const cardX = 32 * scale;
    const cardY = scoreCardY + scoreCardH + 30 * scale;

    ctx.save();
    // Card Body
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 24 * scale;
    ctx.shadowOffsetY = 12 * scale;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24 * scale);
    ctx.fill();

    // Glowing border
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24 * scale);
    ctx.stroke();

    // App Icon Badge
    const iconSize = 64 * scale;
    const iconX = centerX - iconSize / 2;
    const iconY = cardY + 24 * scale;
    ctx.fillStyle = '#0284c7';
    drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 16 * scale);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(28 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', centerX, iconY + iconSize / 2);

    // App Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(22 * scale)}px sans-serif`;
    ctx.fillText(appName, centerX, iconY + iconSize + 26 * scale);

    // Headline
    ctx.fillStyle = '#38bdf8';
    ctx.font = `700 ${Math.round(15 * scale)}px sans-serif`;
    ctx.fillText(headline, centerX, iconY + iconSize + 52 * scale);

    // Description
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 ${Math.round(13 * scale)}px sans-serif`;
    wrapText(ctx, description, centerX, iconY + iconSize + 84 * scale, cardW - 40 * scale, Math.round(18 * scale));

    // Google Play Badge
    const badgeW = 200 * scale;
    const badgeH = 54 * scale;
    drawGooglePlayBadge(ctx, centerX - badgeW / 2, cardY + cardH - badgeH - 24 * scale, badgeW, badgeH, scale);
    ctx.restore();
  } else {
    // Normal 16:9 Landscape Final Screen (Dual Column Layout)
    const midX = width * 0.42;

    // LEFT PANEL: Trophy + Score
    const trophyY = height * 0.38;
    renderTrophy(ctx, midX / 2, trophyY, theme, scale);

    ctx.save();
    ctx.fillStyle = theme.textPrimary;
    ctx.font = `900 ${Math.round(32 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QUIZ COMPLETED!', midX / 2, trophyY + 95 * scale);

    // Score pill
    const scoreCardW = 250 * scale;
    const scoreCardH = 44 * scale;
    const scoreCardY = trophyY + 125 * scale;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    drawRoundedRect(ctx, midX / 2 - scoreCardW / 2, scoreCardY, scoreCardW, scoreCardH, 22 * scale);
    ctx.fill();

    ctx.fillStyle = theme.accentColor;
    ctx.font = `800 ${Math.round(18 * scale)}px sans-serif`;
    ctx.fillText(`${quiz.questions.length} / ${quiz.questions.length} PERFECT SCORE`, midX / 2, scoreCardY + scoreCardH / 2);
    ctx.restore();

    // RIGHT PANEL: Auorta Learning App Showcase Card
    const cardX = midX + 30 * scale;
    const cardY = 80 * scale;
    const cardW = width - cardX - 50 * scale;
    const cardH = height - 160 * scale;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20 * scale;
    ctx.shadowOffsetY = 10 * scale;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24 * scale);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24 * scale);
    ctx.stroke();

    // App Icon & Name Header
    const iconSize = 64 * scale;
    const iconX = cardX + 32 * scale;
    const iconY = cardY + 32 * scale;
    ctx.fillStyle = '#0284c7';
    drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 16 * scale);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(28 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', iconX + iconSize / 2, iconY + iconSize / 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(24 * scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(appName, iconX + iconSize + 18 * scale, iconY + 22 * scale);

    ctx.fillStyle = '#38bdf8';
    ctx.font = `700 ${Math.round(14 * scale)}px sans-serif`;
    ctx.fillText(headline, iconX + iconSize + 18 * scale, iconY + 48 * scale);

    // Feature checkmarks
    const featureY = iconY + iconSize + 26 * scale;
    const features = [
      'Full-Length Timed Mock Tests with All-India Ranks',
      'Previous Years\' Solved Question Papers (PYQs)',
      'Instant Detailed Explanations & Performance Analytics',
    ];

    features.forEach((feat, i) => {
      const fy = featureY + i * 30 * scale;
      ctx.fillStyle = '#34d399';
      ctx.font = `800 ${Math.round(16 * scale)}px sans-serif`;
      ctx.fillText('✓', iconX, fy);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = `600 ${Math.round(14 * scale)}px sans-serif`;
      ctx.fillText(feat, iconX + 26 * scale, fy, cardW - 70 * scale);
    });

    // Google Play Badge
    const badgeW = 210 * scale;
    const badgeH = 54 * scale;
    drawGooglePlayBadge(ctx, iconX, cardY + cardH - badgeH - 30 * scale, badgeW, badgeH, scale);
    ctx.restore();
  }
}

// Trophy graphic helper
function renderTrophy(
  ctx: CanvasRenderingContext,
  centerX: number,
  trophyY: number,
  theme: any,
  scale: number
) {
  ctx.save();
  // Glowing backdrop
  ctx.fillStyle = theme.accentColor;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(centerX, trophyY, 80 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Trophy cup
  ctx.fillStyle = '#fbbf24'; // Gold
  ctx.beginPath();
  ctx.arc(centerX, trophyY - 10 * scale, 42 * scale, 0, Math.PI);
  ctx.fill();

  // Handles
  ctx.lineWidth = 5 * scale;
  ctx.strokeStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(centerX - 42 * scale, trophyY - 18 * scale, 16 * scale, Math.PI / 2, (Math.PI * 3) / 2, true);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX + 42 * scale, trophyY - 18 * scale, 16 * scale, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.stroke();

  // Base stem
  ctx.fillRect(centerX - 10 * scale, trophyY + 32 * scale, 20 * scale, 24 * scale);
  drawRoundedRect(ctx, centerX - 32 * scale, trophyY + 54 * scale, 64 * scale, 12 * scale, 4 * scale);
  ctx.fill();

  // Star in trophy
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

// Text word wrap helper
function wrapText(
  ctx: CanvasRenderingContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight);
  });
}
