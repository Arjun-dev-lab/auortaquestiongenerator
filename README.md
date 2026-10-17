# QuizCraft MP4 - Offline Quiz Video Creator

A high-performance, client-side web application to create, preview, and export vertical (9:16 YouTube Shorts) and horizontal (16:9 widescreen) trivia quiz videos with procedural audio, countdown timers, answer reveals, and promotional branding.

The application runs **100% in the browser** as a static website. It uses the WebCodecs API and embedded WebAssembly H.264 video encoding to generate genuine ISO Base Media File Format MP4 videos (`video/mp4`) without requiring any backend server or external CDN dependencies.

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
