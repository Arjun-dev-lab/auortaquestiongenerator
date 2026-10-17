import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import HME from 'h264-mp4-encoder';
import { QuizConfig } from '../src/types/quiz.ts';
import { renderQuizFrame } from '../src/utils/canvasRenderer.ts';
import { parseAndValidateMp4 } from '../src/utils/mp4Parser.ts';

async function runTwoQuestionQuizTest() {
  console.log('===============================================================');
  console.log('       OFFLINE MP4 EXPORT VERIFICATION TEST');
  console.log('===============================================================\n');

  // 1. Configure a 2-question quiz with short countdowns, reveals, and final screen
  const testQuiz: QuizConfig = {
    title: 'Exam Trivia & GK Challenge',
    theme: 'neon-cyber',
    aspectRatio: '9:16',
    countdownDuration: 1.5, // 1.5s countdown for fast test
    revealDuration: 1.0,    // 1.0s reveal
    finalScreenDuration: 2.0, // 2s final screen
    enableBgm: true,
    bgmVolume: 0.3,
    enableSfx: true,
    sfxVolume: 0.8,
    fps: 15, // 15 fps for test speed
    questions: [
      {
        id: 'q1',
        question: 'Which planet has the highest number of moons?',
        options: ['Mars', 'Jupiter', 'Saturn', 'Neptune'],
        correctIndex: 2, // C: Saturn
        explanation: 'Saturn has 146 confirmed moons orbiting it!',
        category: 'Astronomy',
      },
      {
        id: 'q2',
        question: 'What is the hardest natural substance on Earth?',
        options: ['Titanium', 'Diamond', 'Graphene', 'Quartz'],
        correctIndex: 1, // B: Diamond
        explanation: 'Diamond is pure carbon bonded in a crystal lattice!',
        category: 'Science',
      },
      {
        id: 'q3',
        question: 'Which is the longest river in the world?',
        options: ['Nile River', 'Amazon River', 'Yangtze River', 'Mississippi'],
        correctIndex: 0, // A: Nile River
        explanation: 'The Nile is ~6,650 km long!',
        category: 'Geography',
      },
      {
        id: 'q4',
        question: 'Who is the Chief Architect of the Constitution of India?',
        options: ['Mahatma Gandhi', 'Jawaharlal Nehru', 'Sardar Patel', 'Dr. B. R. Ambedkar'],
        correctIndex: 3, // D: Dr. B. R. Ambedkar
        explanation: 'Dr. B. R. Ambedkar was the Chairman of the Drafting Committee.',
        category: 'Polity',
      },
    ],
    promo: {
      enabled: true,
      appName: 'Auorta Learning App',
      headline: 'Boost Your Exam Preparation with Auorta',
      description: 'Access Full-Length Mock Tests & Solved Previous Year Questions (PYQs)',
      ctaText: 'GET IT ON Google Play',
      tickerText: 'Download Auorta Learning App on Google Play for Mock Tests & PYQs',
      showTicker: true,
      showInFinalScreen: true,
    },
  };

  const totalDuration =
    testQuiz.questions.length * (testQuiz.countdownDuration + testQuiz.revealDuration) +
    testQuiz.finalScreenDuration;
  const totalFrames = Math.round(totalDuration * testQuiz.fps);
  const width = 720;
  const height = 1280;

  console.log(`[1/5] Quiz Parameters:`);
  console.log(`      - Questions: ${testQuiz.questions.length}`);
  console.log(`      - Countdown duration: ${testQuiz.countdownDuration}s per question`);
  console.log(`      - Reveal duration: ${testQuiz.revealDuration}s per question`);
  console.log(`      - Final screen duration: ${testQuiz.finalScreenDuration}s`);
  console.log(`      - Total duration: ${totalDuration.toFixed(1)}s`);
  console.log(`      - Resolution: ${width}x${height} (${testQuiz.aspectRatio})`);
  console.log(`      - Frame rate: ${testQuiz.fps} fps`);
  console.log(`      - Total frames to render & encode: ${totalFrames}\n`);

  // 2. Initialize embedded 100% offline H.264 MP4 encoder
  console.log(`[2/5] Initializing local embedded WebAssembly MP4 encoder (Zero CDN, Zero network)...`);
  const encoder = await HME.createH264MP4Encoder();
  encoder.width = width;
  encoder.height = height;
  encoder.frameRate = testQuiz.fps;
  encoder.kbps = 2000;
  encoder.speed = 10;
  encoder.groupOfPictures = testQuiz.fps * 2;
  encoder.outputFilename = 'test-output.mp4';
  encoder.initialize();
  console.log(`      Encoder initialized successfully.`);

  // 3. Render and encode frames deterministically
  console.log(`\n[3/5] Deterministic Canvas Frame Rendering & Bitstream Encoding...`);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const startTime = Date.now();
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const currentTime = frameIndex / testQuiz.fps;
    renderQuizFrame(ctx as any, testQuiz, currentTime, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    encoder.addFrameRgba(imgData.data);

    if ((frameIndex + 1) % 20 === 0 || frameIndex === totalFrames - 1) {
      const pct = Math.round(((frameIndex + 1) / totalFrames) * 100);
      process.stdout.write(`\r      Progress: Frame ${frameIndex + 1}/${totalFrames} (${pct}%) encoded`);
    }
  }
  console.log(`\n      All ${totalFrames} frames rendered and encoded in ${Date.now() - startTime}ms.`);

  // 4. Finalize MP4 container
  console.log(`\n[4/5] Finalizing ISO Base Media File Format MP4 container...`);
  encoder.finalize();
  const fileBytes = encoder.FS.readFile(encoder.outputFilename);
  encoder.delete();

  const outputPath = path.resolve(process.cwd(), 'test-output.mp4');
  fs.writeFileSync(outputPath, fileBytes);
  console.log(`      Saved test MP4 file to: ${outputPath}`);
  console.log(`      File size: ${fileBytes.length} bytes (${(fileBytes.length / 1024 / 1024).toFixed(3)} MB)`);

  // 5. Deep MP4 Binary & Atom Inspection
  console.log(`\n[5/5] Deep MP4 Binary & Atom Structure Analysis:`);
  const validation = parseAndValidateMp4(fileBytes);

  console.log(`      - Valid MP4 container: ${validation.isValidMp4 ? 'YES (PASS)' : 'NO (FAIL)'}`);
  console.log(`      - Fake WebM disguised as MP4: ${validation.isWebm ? 'YES (FAIL - WebM detected)' : 'NO (PASS - Genuine ISO BMFF)'}`);
  console.log(`      - Major Brand: "${validation.majorBrand}" (Expected "mp42" or "isom")`);
  console.log(`      - Minor Version: ${validation.minorVersion}`);
  console.log(`      - Compatible Brands: [${validation.compatibleBrands.join(', ')}]`);
  console.log(`      - Boxes found in container: ${validation.boxesFound.join(', ')}`);
  console.log(`      - 'ftyp' box present: ${validation.hasFtyp ? 'PASS' : 'FAIL'}`);
  console.log(`      - 'moov' box present: ${validation.hasMoov ? 'PASS' : 'FAIL'}`);
  console.log(`      - 'mdat' box present: ${validation.hasMdat ? 'PASS' : 'FAIL'}`);
  console.log(`      - First 32 bytes hex dump:`);
  console.log(`        ${validation.first64BytesHex.slice(0, 95)}`);

  console.log(`\nDiagnostic messages:`);
  validation.diagnostics.forEach((d) => console.log(`      * ${d}`));

  if (!validation.isValidMp4 || validation.isWebm || !validation.hasFtyp || !validation.hasMoov || !validation.hasMdat) {
    console.error('\nTEST FAILED: Resulting file is not a valid MP4!');
    process.exit(1);
  }

  console.log('\n===============================================================');
  console.log('       TEST PASSED: GENUINE OFFLINE MP4 EXPORT VERIFIED!      ');
  console.log('===============================================================\n');
}

runTwoQuestionQuizTest().catch((err) => {
  console.error('Fatal error during MP4 export test:', err);
  process.exit(1);
});
