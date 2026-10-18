# QuizCraft MP4 - Offline Quiz Video Creator

A high-performance, client-side web application to create, preview, and export vertical (9:16 YouTube Shorts) and horizontal (16:9 widescreen) trivia and exam quiz videos with procedural audio, countdown timers, answer reveals, and promotional branding.

The application runs **100% in the browser** as a static website. It uses the WebCodecs API and embedded WebAssembly H.264 video encoding to generate genuine ISO Base Media File Format MP4 videos (`video/mp4`) without requiring any backend server or external CDN dependencies.

---

## ✨ Features

- **Auorta Learning Quiz Challenge Preset**: Pre-configured with educational branding, bottom tickers, and final-screen spotlight cards for Google Play mock tests and solved previous year questions (PYQs).
- **Statement-Type Question Support**: Supports questions with numbered statements (e.g., Statement 1, Statement 2, Statement 3) and closing prompts (e.g., *"Which of the statements given above are correct?"*), complete with adaptive card heights and safe zones for YouTube Shorts and 16:9 widescreen.
- **Customizable Solution & Fact Cards**: Custom labels (e.g., *"Solution"*, *"Step-by-Step Solution"*, *"Maths Solution"*, *"Key Fact"*, *"Explanation"*) and multi-line step-by-step proofs with comfortable, high-contrast typography that never squishes or shrinks.
- **JSON Import & Paste Feature**: Paste full quiz JSON or arrays of questions directly into the app with one click to populate questions, statements, options, answers, and solutions. Includes quick copyable templates and current-quiz JSON export.
- **Mobile-Friendly Responsive UI**: Fully optimized layout for smartphones and tablets with touch-friendly controls, quick question editor, scene selector, and view modes (*Split*, *Canvas*, *Editor*).
- **Genuine Offline MP4 Export**: Generates true ISO BMFF MP4 bitstreams with real-time progress indicators, frame counter, and deep atom diagnostics (`ftyp`, `moov`, `mdat`).

---

## 📋 JSON Format Specification

You can click **"Import / Paste JSON"** in the app header or editor to load any quiz using the following flexible schema:

```json
{
  "title": "Auorta Learning Quiz Challenge",
  "questions": [
    {
      "question": "Consider the following statements regarding the Solar System:",
      "statements": [
        "1. Saturn has the highest number of confirmed moons (146 moons).",
        "2. Jupiter is the largest planet by mass and volume.",
        "3. Venus has the highest average surface temperature."
      ],
      "questionFooter": "Which of the statements given above are correct?",
      "options": [
        "1 and 2 only",
        "2 and 3 only",
        "1 and 3 only",
        "1, 2, and 3"
      ],
      "answer": "D",
      "explanationLabel": "Solution",
      "explanation": "All three statements are correct! Saturn currently has 146 confirmed moons, and Venus reaches ~465°C due to extreme greenhouse effect.",
      "category": "Astronomy"
    },
    {
      "question": "Find the value of x in the linear equation: 3x - 7 = 2(x + 4)",
      "options": ["x = 11", "x = 15", "x = 18", "x = 22"],
      "answer": "B",
      "explanationLabel": "Maths Solution",
      "explanation": "Step 1: Expand right side: 3x - 7 = 2x + 8\nStep 2: Subtract 2x from both sides: x - 7 = 8\nStep 3: Add 7: x = 15\nTherefore, Option B (x = 15) is correct.",
      "category": "Mathematics"
    }
  ]
}
```

*Note: Answers can be specified as letters (`"A"`, `"B"`, `"C"`, `"D"`) or zero-based indices (`0, 1, 2, 3`). Statements are optional—standard questions without statements are supported seamlessly.*

---

## 🎙️ Strict Sequenced Timing & Natural Human Voice-Over

The application features an intelligent client-side narration and timing engine designed for professional educational and exam videos:

1. **Strict Sequenced Timing**:
   - **Phase 1 (Reading Phase)**: The voice reads the question prompt, statements, and 4 options. **The timer DOES NOT interrupt the voice** and holds steady at full duration showing a sky-blue `LISTEN` pulse.
   - **Phase 2 (Countdown Phase)**: **ONLY AFTER the voice finishes speaking**, the countdown timer starts ticking down (e.g. `4... 3... 2... 1... 0`) with synchronized woodblock tick sound effects.
   - **Phase 3 (Reveal Phase)**: When the countdown reaches zero, the correct option highlights in vibrant emerald green, fanfare chimes play, and the voice announces the correct answer (`"The correct answer is Option B: ..."` or in Malayalam `"ശരിയായ ഉത്തരം, ഓപ്ഷൻ ബി: ..."`) followed by the step-by-step solution.

2. **Ultra-Natural Neural Voices (Zero Robot Tone)**:
   - **Microsoft Edge**: Provides free, broadcast-quality Online Natural Neural voices (such as *Microsoft Midhun / Sobhana Natural* for Malayalam, and *Microsoft Jenny / Guy Natural* for English).
   - **Google Chrome**: Features *Google മലയാളം* and *Google US/UK English*.
   - **Neural Fidelity Protection**: Speech pitch is preserved strictly at `1.0` so modern browser neural models are never downgraded to offline robotic fallbacks.
   - **In-Browser Microphone Studio**: If creators prefer their own authentic human voice, a 1-click in-browser recorder allows recording custom narration directly for any question.

---

## 🚀 Quick Deployment to GitHub Pages (Automated via GitHub Actions)

This repository includes a pre-configured GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys the static site to GitHub Pages whenever you push to `main` or `master`.

### Step 1: Push your code to GitHub

If you haven't already created a GitHub repository:

1. Create a new repository on [GitHub](https://github.com/new) (e.g., named `quizcraft-mp4`).
2. In your local project directory, open your terminal and run:

```bash
# Initialize git if not already initialized
git init

# Add all files (node_modules and build artifacts are automatically ignored)
git add .

# Commit changes
git commit -m "Setup QuizCraft for GitHub Pages"

# Rename branch to main
git branch -M main

# Link to your remote GitHub repository (replace with your actual username and repo name)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git

# Push your code
git push -u origin main
```

---

### Step 2: Enable GitHub Pages in Repository Settings

Once your code is pushed to GitHub:

1. Open your repository on GitHub in your browser.
2. Click the **Settings** tab at the top.
3. In the left navigation menu, click **Pages** (under the "Code and automation" section).
4. Under **Build and deployment**:
   - For **Source**, select **GitHub Actions** from the dropdown menu (do **not** select "Deploy from a branch").
5. That's it! GitHub Pages is now active.

---

### Step 3: View your Live Website

1. Click on the **Actions** tab at the top of your repository.
2. You will see the **Deploy to GitHub Pages** workflow running automatically.
3. Once the workflow finishes (green checkmark, usually ~1 minute), click the job to view your live URL:
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/
   ```

---

## ⚙️ How the Base Path Works (Zero Configuration Needed)

Vite requires the correct `base` path so that stylesheets, scripts, and WebAssembly bundles load correctly from your repository subfolder (`/YOUR_REPOSITORY/`).

This project handles the base path **automatically**:

- **Automatic detection**: In GitHub Actions, Vite automatically reads the environment variable `GITHUB_REPOSITORY` provided by GitHub and sets `base: /YOUR_REPOSITORY/`. You **do not** need to edit `vite.config.ts` or hardcode your repository name.
- **Local development**: When running locally (`npm run dev` or `npm run build`), it automatically falls back to portable relative paths (`./`).
- **Custom domains**: If you connect a custom domain (e.g., `quiz.mywebsite.com`), you can set the repository variable `VITE_BASE_PATH=/` in **Settings > Secrets and variables > Actions > Variables**, or update it in `vite.config.ts`.

---

## 🛠️ Static Hosting & 404 Prevention Features

This project includes built-in configurations specifically tailored for GitHub Pages static hosting:

1. **`public/.nojekyll`**:
   Bypasses Jekyll processing on GitHub Pages, ensuring all asset directories and files are served without modification.
2. **`public/404.html`**:
   Handles Single-Page Application (SPA) routing, automatically redirecting any page refresh back to `index.html` while preserving URL query parameters.
3. **100% Client-Side Video & Audio**:
   - Video frames are rendered on an HTML5 `<canvas>`.
   - Procedural sounds (ticks, risers, reveal chimes, fanfare) are synthesized using the browser's `OfflineAudioContext` (Web Audio API).
   - MP4 files are multiplexed in memory (`mp4-muxer` and `h264-mp4-encoder`).
   - Zero backend server, zero Node.js server, and zero external CDN dependencies required.

---

## 💻 Local Development Commands

To run and test the application on your computer:

```bash
# 1. Install dependencies
npm install

# 2. Start the local Vite development server (port 3000)
npm run dev

# 3. Test the production build locally
npm run build
npm run preview

# 4. Run the automated MP4 export verification test
npm test
```

---

## ❓ Troubleshooting

- **The page is blank after deployment:**
  - Check the browser Console (F12 > Console). If you see 404 errors for `.js` or `.css` files, verify that GitHub Pages **Source** is set to **GitHub Actions** in **Settings > Pages**.
- **Action workflow failed:**
  - Go to the **Actions** tab in GitHub and click the failed workflow to view logs.
  - Ensure the workflow has write permissions: in your repository, go to **Settings > Actions > General > Workflow permissions** and select **Read and write permissions**.
