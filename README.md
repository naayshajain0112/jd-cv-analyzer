# JD–CV Assessment Platform

A full-stack AI-powered platform to analyze job descriptions, assess candidate CVs, generate eligibility checks, interview questions, and downloadable PDF reports.

---

## Tech Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | React 19, Vite, React Router, CSS (existing design) |
| Backend    | Node.js, Express, MongoDB (Mongoose)             |
| AI         | Google Gemini 1.5 Flash (`@google/generative-ai`) |
| File Parse | `pdf-parse` (PDF), `mammoth` (DOCX)             |
| PDF Export | `pdfkit`                                         |
| Uploads    | `multer`                                         |
| Logging    | `winston`                                        |

---

## Project Structure

```
project/
├── frontend/          ← React + Vite (existing UI, wired to backend)
│   ├── src/
│   │   ├── api.js     ← All API calls
│   │   ├── pages/     ← UploadJD, ReviewJD, UploadResume, Report
│   │   └── components/
│   └── .env.example
│
└── backend/
    ├── src/
    │   ├── app.js
    │   ├── routes/        ← jd.js, assessment.js, report.js
    │   ├── controllers/   ← jdController, assessmentController, reportController
    │   ├── services/      ← geminiService, scoringService, pdfService, extractionService
    │   ├── middleware/     ← upload.js, errorHandler.js
    │   ├── models/        ← index.js (JD, Assessment)
    │   ├── utils/         ← logger.js, db.js
    │   └── prompts/       ← jdPrompts.js, cvPrompts.js
    └── .env.example
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/jd-cv-analyzer
GEMINI_API_KEY=your_gemini_api_key_here
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info
```

### Frontend (`frontend/.env.local`) — only needed for production

```env
VITE_API_URL=https://your-backend.onrender.com/api
```

> In development, Vite's built-in proxy routes `/api` → `localhost:5000` automatically. No frontend env variable needed locally.

---

## Local Setup

### Prerequisites

- Node.js ≥ 18
- MongoDB Atlas account (free tier works) or local MongoDB
- Google AI Studio API key → https://aistudio.google.com/app/apikey

### Step 1 — Backend

```bash
cd backend
cp .env.example .env
# Fill in MONGODB_URI and GEMINI_API_KEY in .env

npm install
npm run dev       # starts on http://localhost:5000
```

### Step 2 — Frontend

```bash
cd frontend
npm install
npm run dev       # starts on http://localhost:5173
```

Open http://localhost:5173 in your browser.

---

## Application Flow

1. **Upload JD** (`/`) — Paste text or upload PDF/DOCX/TXT → Gemini extracts structured requirements
2. **Review JD** (`/review`) — Edit extracted fields (title, experience, education, location, skills, mandatory requirements, reject conditions) → Approve → Generate assessment criteria with weights (hard 70%, soft 30%)
3. **Upload Resumes** (`/upload-resume`) — Upload one or more CVs (PDF/DOCX/TXT) → Backend extracts text, Gemini rates skills 1–5, **backend scoring engine** calculates weighted scores
4. **Report** (`/report`) — View sorted candidates with eligibility checks, skill ratings, gaps, interview questions. Override scores/verdicts. Download PDF.

---

## Scoring Engine

Scoring is **100% code-based** — Gemini only provides 1–5 ratings per skill.

```
Hard Skill Score  = sum(rating × weight) / (5 × totalHardWeight) × 100
Soft Skill Score  = sum(rating × weight) / (5 × totalSoftWeight) × 100
Weighted Score    = hardScore × 0.70 + softScore × 0.30

Classification:
  85–100 → Strong Fit
  70–84  → Moderate Fit
  50–69  → Weak Fit
  < 50   → Reject
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jd/extract` | Extract JD from text or file |
| GET  | `/api/jd/:id` | Get JD |
| PUT  | `/api/jd/:id/approve` | Approve with edits |
| POST | `/api/jd/:id/criteria` | Generate assessment criteria |
| POST | `/api/assessment/assess` | Assess CV files against a JD |
| GET  | `/api/assessment/by-jd/:jdId` | Get all assessments for a JD |
| GET  | `/api/assessment/:id` | Get single assessment |
| PUT  | `/api/assessment/:id/override` | Save recruiter override |
| GET  | `/api/report/:assessmentId/pdf` | Download PDF report |
| GET  | `/api/health` | Health check |

---

## Deployment

### Backend → Render

1. Push `backend/` to a GitHub repository
2. Create a new **Web Service** on [render.com](https://render.com)
3. Connect your repo; set Build Command: `npm install`, Start Command: `npm start`
4. Add environment variables: `MONGODB_URI`, `GEMINI_API_KEY`, `FRONTEND_URL` (your Vercel URL), `NODE_ENV=production`
5. Deploy — note your Render URL (e.g. `https://jd-cv-api.onrender.com`)

### Frontend → Vercel

1. Push `frontend/` to a GitHub repository
2. Import project on [vercel.com](https://vercel.com)
3. Add environment variable: `VITE_API_URL=https://your-backend.onrender.com/api`
4. Deploy

The `vercel.json` in the frontend handles SPA routing (all paths → `index.html`).

---

## Notes

- Uploaded files are stored temporarily on disk and deleted after text extraction
- MongoDB stores JD extractions and assessment results for retrieval
- The platform supports up to 20 CVs per batch
- PDF reports are generated on-demand (not stored)
