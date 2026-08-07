# 🚀 AI Interview & Assessment Platform — Comprehensive Architecture & Tech Documentation

Welcome to the **AI Interview & Assessment Platform** codebase! This document provides a complete breakdown of the project's tech stack, architectural design, core features, database schema, API routes, and local developer setup guide.

---

## 📌 1. Project High-Level Summary

The **AI Interview & Assessment Platform** is an enterprise-grade web application built to automate candidate technical and behavioral screening. It allows recruiters to upload Job Descriptions (JDs) and automatically generate, conduct, and evaluate three distinct modes of assessment:

1. **Online Assessment (OA)** — Dynamic MCQs, coding challenges (with live browser IDE), and technical scenario questions.
2. **AI Voice/Audio Interview** — Real-time voice-to-voice interview conducted by an AI agent using speech-to-text (STT) and text-to-speech (TTS).
3. **AI Agent Technical Interview** — Interactive multi-turn conversational technical interview with dynamic follow-ups based on candidate responses.
4. **Comprehensive Candidate Diagnostics & Reports** — Automated grading engine calculating scores across code efficiency, domain knowledge, communication skills, and problem-solving metrics.

---

## 🛠️ 2. Technology Stack

### **Frontend & Framework**
* **Framework:** [Next.js 16 (App Router)](https://nextjs.org/)
* **Library:** React 19 (`react`, `react-dom`)
* **Language:** TypeScript 5
* **Styling:** Tailwind CSS v4 + `@tailwindcss/postcss`
* **UI Component Library:** Lucide React icons, `@base-ui/react`, Shadcn UI components, `tw-animate-css`
* **Form & Validation:** `react-hook-form` + `zod`
* **Toast Notifications:** `sonner`

### **Backend & Database**
* **Backend Platform:** Appwrite Cloud (SDK `appwrite` v26)
  * **Database:** Appwrite NoSQL Database
  * **Authentication:** Appwrite Auth
  * **Storage:** Appwrite Storage Bucket (Audio clips, candidate attachments)

### **AI & Voice Services**
* **AI LLM Engine:**
  * **NVIDIA GPT OSS 20b** (Primary LLM for question generation, evaluation, and conversational responses) via `NVIDIA_API_KEY`.
  * **Google Gemini API** (Fallback/Legacy AI provider) via `GEMINI_API_KEY`.
* **Voice Processing (STT / TTS):**
  * **Deepgram API** (`DEEPGRAM_API_KEY`) for real-time speech transcription (STT) and voice synthesis (TTS).

### **Code Execution & IDE**
* **Code Editor:** `@monaco-editor/react` (VS Code engine in browser)
* **Execution & Code Judge:** Client & server-side JavaScript/Python execution engine (`judge.service.ts`) with custom test-case validation.

---

## 📂 3. Directory & Folder Structure

```
aiinterview/
├── app/                        # Next.js App Router (Pages & API Routes)
│   ├── (auth)/                 # Login & Registration views
│   ├── dashboard/              # Candidate & Recruiter Dashboard
│   │   ├── ai/                 # AI Agent Interview Interface
│   │   ├── assignments/        # Assigned Assessments List
│   │   ├── audio/              # Voice/Audio Interview View
│   │   ├── oa/                 # Online Assessment (Coding + MCQs) Exam Portal
│   │   └── report/             # Diagnostic Candidate Performance Reports
│   ├── api/                    # Serverless API Routes
│   │   ├── ai-interview/       # AI agent interview state & turn endpoints
│   │   ├── audio-interview/    # Audio stream & response endpoints
│   │   ├── deepgram/           # Deepgram STT/TTS proxy token generator
│   │   ├── interview/          # Core interview lifecycle endpoints
│   │   ├── oa/                 # OA generation & submission handlers
│   │   └── report/             # Report compilation API
│   ├── globals.css             # Tailwind v4 globals & custom themes
│   └── layout.tsx              # Root HTML Layout & Providers
├── src/                        # Main Business Logic & Source Code
│   ├── components/             # UI Components (Monaco Editor, Timers, Audio Visualizer, etc.)
│   ├── constants/              # Application constants & configuration defaults
│   ├── data/                   # Seed data and mock templates
│   ├── hooks/                  # Custom React Hooks (e.g. mic recorder, timer, store)
│   ├── lib/                    # Core Infrastructure Utilities
│   │   ├── appwrite.ts         # Appwrite Client SDK initialization
│   │   ├── contextParser.ts    # Resume/JD text extraction and token parsing
│   │   ├── exam-immersive.ts   # Anti-cheat & fullscreen monitor utilities
│   │   └── reportFormatter.ts  # Score calculator and report formatter
│   ├── prompts/                # Structured AI Prompts for Question Generation & Grading
│   ├── services/               # Core Modular Business Services
│   │   ├── ai-interview.service.ts    # Handles text-based AI interview turns
│   │   ├── ai-provider.interface.ts  # Strategy pattern interface for AI LLMs
│   │   ├── audio-interview.service.ts # Voice interview workflow service
│   │   ├── auth.service.ts            # Appwrite authentication wrapper
│   │   ├── db.service.ts              # Appwrite CRUD operation wrapper
│   │   ├── e2e-oa.service.ts          # End-to-end OA test execution manager
│   │   ├── evaluation.service.ts      # LLM grading & feedback compiler
│   │   ├── gemini.provider.ts         # Google Gemini API client implementation
│   │   ├── gpt-oss.provider.ts        # NVIDIA GPT-OSS API client implementation
│   │   ├── jd.service.ts              # Job Description processing & storage service
│   │   ├── judge.service.ts           # Monaco code runner & unit test evaluator
│   │   └── offline-fallbacks.ts       # Fallback mock generators when APIs are offline
│   ├── types/                  # TypeScript Data Interfaces & Models
│   └── validators/             # Zod validation schemas
├── .env.local                  # Environment variables & API credentials
├── package.json                # Project dependencies and npm scripts
└── README_APPWRITE.md          # Appwrite setup notes
```

---

## 🗄️ 4. Appwrite Database Schema & Storage

The application relies on an Appwrite Database ID (`NEXT_PUBLIC_APPWRITE_DATABASE_ID`).

| Collection Name | Env Variable ID | Purpose |
| :--- | :--- | :--- |
| **Users** | `NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID` | Stores candidate/interviewer profiles, names, emails, and roles. |
| **Job Descriptions (JD)** | `NEXT_PUBLIC_APPWRITE_JD_COLLECTION_ID` | Uploaded JDs, required skills, experience level, and role title. |
| **Online Assessments (OA)** | `NEXT_PUBLIC_APPWRITE_OA_COLLECTION_ID` | Generated test suites (MCQs + Coding challenges), candidate submissions, pass/fail status. |
| **AI Agent Interviews** | `NEXT_PUBLIC_APPWRITE_AI_COLLECTION_ID` | Multi-turn chat transcript, dynamic prompts, and AI feedback. |
| **Audio Interviews** | `NEXT_PUBLIC_APPWRITE_AUDIO_COLLECTION_ID` | Voice interview metadata, transcripts, Deepgram audio tokens. |
| **Full Evaluation Records** | `NEXT_PUBLIC_APPWRITE_FULL_COLLECTION_ID` | Aggregated report scores, benchmark stats, and final hiring recommendations. |

* **Storage Bucket (`NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID`):** Holds candidate audio session recordings, uploaded PDFs/resumes, and assessment attachments.

---

## 🔄 5. Key Application Workflows

### A. Online Assessment (OA) Flow
1. **JD Ingestion:** Recruiter uploads a JD or inputs skill requirements.
2. **AI Question Generation:** `gpt-oss.provider.ts` or `gemini.provider.ts` generates tailored MCQs and Coding Problems matching the JD.
3. **Immersive Exam:** Candidate enters `/dashboard/oa`. The environment enables fullscreen anti-cheat listeners (`exam-immersive.ts`) and presents code challenges in the **Monaco Editor**.
4. **Code Execution:** Candidate code is evaluated in real time via `judge.service.ts`.
5. **Grading & Report:** Submissions are automatically parsed and saved to Appwrite `oa_collection`.

### B. AI Voice / Audio Interview Flow
1. Candidate navigates to `/dashboard/audio`.
2. App requests temporary token from `/api/deepgram`.
3. Candidate speaks into the microphone -> Deepgram converts Speech to Text (STT).
4. Text transcript is sent to AI Service (`gpt-oss` / `gemini`) -> AI generates dynamic response.
5. Deepgram converts AI text response to audio (TTS) and streams back to the browser speaker.
6. Conversation transcript and audio metrics are saved in `audio_collection`.

### C. Diagnostic Report Generation
1. `reportFormatter.ts` aggregates scores across all test components (Coding score, MCQ score, Audio performance, Communication score).
2. Generates a visual dashboard on `/dashboard/report` featuring breakdown charts, strengths, areas for improvement, and an overall hiring score out of 100.

---

## ⚙️ 6. Environment Variables (`.env.local`)

To run the application locally, configure the following key-value pairs in `.env.local`:

```ini
# Appwrite Cloud Configuration
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<your_project_id>
NEXT_PUBLIC_APPWRITE_DATABASE_ID=<your_database_id>
NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID=users_collection
NEXT_PUBLIC_APPWRITE_JD_COLLECTION_ID=jd_collection
NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID=<your_bucket_id>

# Assessment Collections
NEXT_PUBLIC_APPWRITE_OA_COLLECTION_ID=oa_collection
NEXT_PUBLIC_APPWRITE_AI_COLLECTION_ID=ai_collection
NEXT_PUBLIC_APPWRITE_AUDIO_COLLECTION_ID=audio_collection
NEXT_PUBLIC_APPWRITE_FULL_COLLECTION_ID=full_collection

# AI Service Provider Credentials
NVIDIA_API_KEY=<your_nvidia_api_key>
NEXT_PUBLIC_AI_PROVIDER=gpt-oss # Options: gpt-oss | gemini
GEMINI_API_KEY=<your_gemini_api_key>

# Voice Service Credentials
DEEPGRAM_API_KEY=<your_deepgram_api_key>
```

---

## 💻 7. Local Developer Getting Started Guide

### Prerequisites
* **Node.js**: v20+ installed
* **Package Manager**: `npm` (v10+)
* **Git**: Installed

### Step-by-Step Setup
1. **Clone the Repository:**
   ```bash
   git clone <repository_url>
   cd aiinterview
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Ensure `.env.local` is present in the root folder with valid API keys (Appwrite, NVIDIA / Gemini, Deepgram).

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Useful Scripts:**
   - `npm run dev`: Starts local development server on port 3000.
   - `npm run build`: Builds production optimized build.
   - `npm run start`: Runs production build.
   - `npm run lint`: Runs ESLint check.

## 🧩 8. Detailed System Modules & Features Breakdown

The codebase is structured into 9 core business and technical modules. Below is a detailed breakdown of what each module does, how it works under the hood, and the features it offers:

---

### 1️⃣ Authentication & User Management Module
* **Location:** `src/services/auth.service.ts`, `src/services/user.service.ts`, `app/(auth)/`
* **Features Offered:**
  * Candidate and Recruiter registration & email/password authentication.
  * Session state management and automatic token renewal.
  * Role-based access control (Recruiter vs. Candidate views).
  * User profile synchronization with Appwrite.
* **How It Works:**
  Uses the Appwrite Client SDK `Account` API to establish authenticated sessions. Upon successful login/signup, the user profile is created or updated in the `users_collection` database to maintain persistent user roles and preferences across dashboard routes.

---

### 2️⃣ Job Description (JD) & Context Ingestion Module
* **Location:** `src/services/jd.service.ts`, `src/lib/contextParser.ts`, `src/components/JDUpload/`
* **Features Offered:**
  * Raw Job Description text input and resume file parsing (PDF/DOCX).
  * Automatic keyword and skill tag extraction (e.g., React, Python, Distributed Systems).
  * Role seniority classification (Junior, Mid, Senior, Lead).
* **How It Works:**
  `contextParser.ts` cleans raw text inputs, strips formatting noise, and extracts core technology requirements using regex heuristics and tokenization. The parsed JD object is stored in Appwrite `jd_collection` and fed directly into the question generation pipeline.

---

### 3️⃣ Assessment Suite Generator & Configuration Module
* **Location:** `src/components/Dashboard/InterviewConfiguration.tsx`, `src/services/e2e-oa.service.ts`
* **Features Offered:**
  * Customizable assessment builder (set test duration, difficulty level, question distribution).
  * Multi-format question synthesis (MCQs, Coding Challenges, System Design/Behavioral).
  * Automatic test key and candidate invitation generation.
* **How It Works:**
  Recruiters configure test parameters in `InterviewConfiguration.tsx`. `e2e-oa.service.ts` combines the parsed JD with system prompts in `src/prompts/` and dispatches requests to the active AI LLM (`gpt-oss` or `gemini`). The synthesized assessment suite is saved to `oa_collection`.

---

### 4️⃣ Online Assessment (OA) & Anti-Cheat Proctoring Module
* **Location:** `app/dashboard/oa/`, `src/lib/exam-immersive.ts`, `src/components/Interview/ProctoringProvider.tsx`, `ExamFullscreenGate.tsx`
* **Features Offered:**
  * Timed, interactive exam portal for candidates.
  * Strict Fullscreen Enforcement (blocks exam start until browser is in fullscreen mode).
  * Real-time Anti-Cheat Event Tracking (detects tab switching, window blur, `Alt+Tab`, copy-paste attempts).
  * Automated Exam Auto-Submission when time expires or proctoring threshold is violated.
* **How It Works:**
  `ProctoringProvider` attaches event listeners to window blur, visibility state changes, and keydown combinations. Violations increment an in-memory infraction counter and display warning alerts. `exam-immersive.ts` forces standard screen lock APIs.

---

### 5️⃣ Live IDE & Code Execution Judge Module
* **Location:** `src/services/judge.service.ts`, `@monaco-editor/react` components
* **Features Offered:**
  * Embedded VS Code editing experience (syntax highlighting, auto-completion, line numbers).
  * Multi-language support (JavaScript, Python, C++, Java).
  * Real-time code execution against public sample test cases and hidden evaluation test cases.
  * Time and memory limit tracking with detailed execution stack traces.
* **How It Works:**
  Renders Monaco Editor in the candidate portal. When the candidate clicks **Run** or **Submit**, `judge.service.ts` sends the code payload to a sandboxed execution runner, compares output against target outputs, and calculates pass/fail rates.

---

### 6️⃣ AI Voice / Audio Interview Module
* **Location:** `src/services/audio-interview.service.ts`, `app/api/deepgram/`, `app/dashboard/audio/`
* **Features Offered:**
  * Real-time hands-free voice-to-voice interview experience.
  * Sub-second Speech-to-Text (STT) transcription of candidate voice.
  * Natural AI Text-to-Speech (TTS) voice generation for interviewer questions.
  * Live audio visualizer waveform during candidate speech.
* **How It Works:**
  Web Audio API captures candidate mic input -> streams audio chunks to Deepgram STT -> Deepgram returns text transcript -> LLM provider generates conversational follow-up question -> Deepgram TTS converts response to audio -> Browser plays audio back. Full conversation log is persisted in `audio_collection`.

---

### 7️⃣ AI Agent Technical Interview Module
* **Location:** `src/services/ai-interview.service.ts`, `app/dashboard/ai/`
* **Features Offered:**
  * Multi-turn chat-based technical interview.
  * Adaptive questioning (AI asks deep follow-up questions if candidate's answer is incomplete or vague).
  * Technical depth probing across system architecture, edge cases, and trade-offs.
* **How It Works:**
  Functions as a virtual Senior Technical Interviewer. Maintains dialogue history in state and Appwrite `ai_collection`. Evaluates each candidate turn dynamically and determines whether to probe further into the current topic or transition to the next technical area.

---

### 8️⃣ Candidate Diagnostic & Evaluation Report Engine Module
* **Location:** `src/services/report-engine/` (`generate-report.ts`, `evaluate-answers.ts`, `answer-quality.ts`, `aggregate.ts`), `src/lib/reportFormatter.ts`, `app/dashboard/report/`
* **Features Offered:**
  * Comprehensive candidate scorecards (Overall Score out of 100).
  * 5-Dimension Radar Chart Breakdown: Coding Proficiency, Technical Depth, Communication Skills, Problem Solving, Time Efficiency.
  * Categorized Hiring Recommendations: **Strong Hire**, **Hire**, **Consider**, **Reject**.
  * Question-by-question breakdown showing candidate code, target solution, and AI feedback.
* **How It Works:**
  `evaluate-answers.ts` passes candidate submissions through grading prompts. `answer-quality.ts` rates code efficiency and correctness. `aggregate.ts` performs mathematical weighted scoring. `generate-report.ts` outputs a complete report object stored in `full_collection` and rendered visually in `/dashboard/report`.

---

### 9️⃣ AI Provider Abstraction Strategy Layer
* **Location:** `src/services/ai-provider.interface.ts`, `src/services/gpt-oss.provider.ts`, `src/services/gemini.provider.ts`, `src/services/offline-fallbacks.ts`
* **Features Offered:**
  * Modular strategy pattern for seamless AI vendor switching.
  * Support for NVIDIA GPT-OSS 20b and Google Gemini 1.5/2.0.
  * Offline fallback mode (generates mock interview data if external AI APIs are down or keys are missing).
* **How It Works:**
  All application components depend on the `AIProviderInterface` contract instead of SDK-specific code. Switching `NEXT_PUBLIC_AI_PROVIDER` in `.env.local` instantly swaps the underlying AI provider across the entire system without changing UI code.

---

## 💡 9. Key Architectural Guidelines for Developers

* **Modular AI Providers:** Never hardcode LLM API calls inside components. Always use `AIProviderInterface` (`src/services/ai-provider.interface.ts`). This allows switching between NVIDIA GPT-OSS, Google Gemini, or OpenAI effortlessly.
* **Offline Resilience:** Check `src/services/offline-fallbacks.ts` if working on features offline without live LLM/Appwrite API keys.
* **Appwrite Service Layer:** Avoid calling Appwrite SDK directly in UI pages. Route all database interactions through `src/services/db.service.ts` and `auth.service.ts`.
* **TypeScript Types:** All data schemas (assessments, questions, candidate responses) are strictly typed in `src/types/`. Always import existing types before creating new ones.

