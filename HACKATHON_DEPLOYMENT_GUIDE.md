# 🏆 SecureData Forensics — Hackathon Deployment & Presentation Guide

This guide explains how to present your software to remote judges using the **Online Frontend + Local Agent (Hybrid)** architecture.

---

## 🌟 How It Works (The Judge Experience)

Judges evaluate your project remotely from your **PowerPoint presentation**:

1. **The Judge clicks your online link** (e.g. https://securedata-forensics.vercel.app).
2. **The software immediately opens in their browser**:
   - If they **don't want to install anything** (e.g. on mobile, Mac, or quick evaluation):
     - They click **🧪 Try Demo Mode**.
     - All screens (Live Inventory, Deleted File Carving, NIST 800-88 Sanitization, PDF Certificate Generation) function with realistic forensic evidence!
   - If they **want to test real hardware detection on their own PC**:
     - They click **📥 Download Agent** (downloads SecureData-Agent-Windows.zip).
     - They double-click SecureData-Agent.exe (auto-elevates to Admin).
     - The web page status turns to **🟢 LOCAL AGENT CONNECTED**.
     - **Their physical USB thumb drives, external drives, and phones appear live in the browser!**

---

## 🚀 Step 1: Deploy the Frontend to Vercel (Free & 2 Minutes)

Vercel gives you a permanent, high-speed https://your-project.vercel.app URL for free.

### Method A: Via GitHub (Recommended)
1. Push your repository to GitHub:
   `ash
   git add .
   git commit -m "Add Local Agent & Demo Mode support"
   git push origin main
   `
2. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
3. Click **Add New Project** → Select your repository.
4. Set **Root Directory** to rontend.
5. Click **Deploy**.
6. In ~60 seconds, you get your live link: https://securedata-forensics.vercel.app!

### Method B: Via Vercel CLI (No GitHub needed)
`ash
cd d:\SIH\frontend
npx vercel
`
Follow the terminal prompts, and you will get a live URL in 1 minute.

---

## 📦 Step 2: Upload the Agent to Google Drive (Or GitHub Releases)

We have already compiled and zipped the agent for you:
- File location: d:\SIH\SecureData-Agent-Windows.zip

1. Upload SecureData-Agent-Windows.zip to your **Google Drive**.
2. Right-click the file in Google Drive → **Share** → set to **Anyone with the link**.
3. Copy the link.

*(Note: The zip file is also placed in rontend/public/SecureData-Agent-Windows.zip so users can download it directly from your web app!)*

---

## 📊 Step 3: What to Put in Your PPT Slides

Create a dedicated **"Live Software Demonstration"** slide with this layout:

`
┌────────────────────────────────────────────────────────────────────────┐
│                      LIVE SOFTWARE DEMONSTRATION                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   🌐 1. ONLINE WEB APPLICATION                                         │
│      URL: https://securedata-forensics.vercel.app                      │
│      • Open in any web browser (Windows, Mac, Linux, Mobile)           │
│      • Click 'Try Demo Mode' for instant hardware simulation           │
│                                                                        │
│   ⚡ 2. REAL PHYSICAL HARDWARE DETECTION (OPTIONAL AGENT)              │
│      Download Agent: [Google Drive Link / Embedded in Web UI]          │
│      • Plug your own USB drive into your PC                            │
│      • Run SecureData-Agent.exe (Windows 10/11)                        │
│      • Web dashboard automatically connects to your local hardware!     │
│                                                                        │
│   📹 3. 90-SECOND SYSTEM WALKTHROUGH VIDEO                             │
│      [Embedded video player or link]                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
`

---

## 🔄 Step 4: How to Update Your Software Anytime

### To update Frontend (UI, Design, Pages):
1. Make your edits in rontend/src/.
2. Run git push.
3. Vercel automatically deploys your update in ~1 minute — your PPT link remains the same!

### To update Backend (PowerShell detection, file carving algorithms):
1. Make your edits in ackend/app/.
2. Double-click d:\SIH\build_agent.bat.
3. It automatically re-compiles SecureData-Agent.exe and packages SecureData-Agent-Windows.zip.
4. Upload the new zip to your Google Drive link.

---

## 🛠️ Summary of Files Created

| File | Description |
|---|---|
| d:\SIH\backend\dist\SecureData-Agent\ | Pre-compiled standalone executable folder (no Python needed). |
| d:\SIH\SecureData-Agent-Windows.zip | Standalone zip package ready to upload to Google Drive. |
| d:\SIH\build_agent.bat | 1-click script to rebuild the agent after changing backend code. |
| d:\SIH\frontend\src\components\AgentStatusBar.tsx | Status banner with live detection, demo mode & agent download modal. |
| d:\SIH\frontend\src\services\agentConnection.ts | Dynamic localhost agent detection with Private Network Access support. |
| d:\SIH\frontend\src\services\mockData.ts | Forensic simulation dataset for zero-install demo evaluations. |
