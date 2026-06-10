import { useLocation, useNavigate } from 'react-router-dom';
import './Report.css';

/* ---------- Placeholder candidate data ---------- */
const mockCandidates = [
  {
    name: 'Aarav Sharma',
    resume: 'aarav_sharma_resume.pdf',
    score: 92,
    matchedSkills: ['React', 'Node.js', 'Docker', 'PostgreSQL', 'CI/CD', 'Git', 'Agile'],
    missingSkills: ['TypeScript', 'REST APIs'],
    experience: '5 years',
    education: 'B.Tech in CSE',
    verdict: 'Strong Match',
  },
  {
    name: 'Priya Patel',
    resume: 'priya_patel_cv.pdf',
    score: 78,
    matchedSkills: ['React', 'REST APIs', 'Git', 'Agile', 'TypeScript'],
    missingSkills: ['Docker', 'CI/CD', 'PostgreSQL', 'Node.js'],
    experience: '3 years',
    education: 'MCA',
    verdict: 'Good Match',
  },
  {
    name: 'Rohan Gupta',
    resume: 'rohan_gupta_cv.docx',
    score: 54,
    matchedSkills: ['Git', 'Agile', 'REST APIs'],
    missingSkills: ['React', 'Node.js', 'Docker', 'PostgreSQL', 'CI/CD', 'TypeScript'],
    experience: '1 year',
    education: 'B.Sc in IT',
    verdict: 'Partial Match',
  },
];

/* ---------- Helpers ---------- */
function verdictBadge(verdict) {
  if (verdict.includes('Strong')) return 'badge-success';
  if (verdict.includes('Good'))   return 'badge-warning';
  return 'badge-danger';
}

function scoreColor(score) {
  if (score >= 80) return 'var(--clr-success)';
  if (score >= 60) return 'var(--clr-warning)';
  return 'var(--clr-danger)';
}

/* ---------- ScoreRing ---------- */
function ScoreRing({ score }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="score-ring">
      <svg viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke="rgba(255,255,255,.06)"
          strokeWidth="8"
        />
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <span className="score-ring__label">{score}</span>
    </div>
  );
}

/* ---------- Report Page ---------- */
export default function Report() {
  const navigate  = useNavigate();
  const { state } = useLocation();

  // Could use state?.requirements in a real app
  const candidates = mockCandidates;

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div className="section-header">
          <p className="section-header__badge">✦ Step 4</p>
          <h1 className="section-header__title">Candidate Assessment Report</h1>
          <p className="section-header__subtitle">
            AI-powered analysis of{' '}
            <strong>{candidates.length} candidate{candidates.length > 1 ? 's' : ''}</strong>{' '}
            against the job requirements.
          </p>
        </div>

        {/* Summary bar */}
        <div className="report__summary glass-card">
          <div className="report__summary-item">
            <span className="report__summary-value">{candidates.length}</span>
            <span className="report__summary-label">Candidates</span>
          </div>
          <div className="report__summary-divider" />
          <div className="report__summary-item">
            <span className="report__summary-value" style={{ color: 'var(--clr-success)' }}>
              {candidates.filter((c) => c.score >= 80).length}
            </span>
            <span className="report__summary-label">Strong Matches</span>
          </div>
          <div className="report__summary-divider" />
          <div className="report__summary-item">
            <span className="report__summary-value">
              {Math.round(candidates.reduce((a, c) => a + c.score, 0) / candidates.length)}%
            </span>
            <span className="report__summary-label">Avg. Score</span>
          </div>
        </div>

        {/* Candidate cards */}
        <div className="report__candidates">
          {candidates.map((c) => (
            <div key={c.name} className="glass-card report__candidate">
              <div className="report__candidate-header">
                <div>
                  <h2 className="report__candidate-name">{c.name}</h2>
                  <p className="report__candidate-file">{c.resume}</p>
                </div>
                <ScoreRing score={c.score} />
              </div>

              <div className="report__candidate-meta">
                <span className={`badge ${verdictBadge(c.verdict)}`}>
                  {c.verdict}
                </span>
                <span className="badge badge-accent">🎓 {c.education}</span>
                <span className="badge badge-accent">📅 {c.experience}</span>
              </div>

              {/* Matched Skills */}
              <div className="report__skills-group">
                <h3 className="report__skills-title report__skills-title--matched">
                  ✅ Matched Skills
                </h3>
                <div className="chip-list">
                  {c.matchedSkills.map((s) => (
                    <span key={s} className="chip chip--success">{s}</span>
                  ))}
                </div>
              </div>

              {/* Missing Skills */}
              {c.missingSkills.length > 0 && (
                <div className="report__skills-group">
                  <h3 className="report__skills-title report__skills-title--missing">
                    ❌ Missing Skills
                  </h3>
                  <div className="chip-list">
                    {c.missingSkills.map((s) => (
                      <span key={s} className="chip chip--danger">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skill match progress */}
              <div className="report__progress-wrap">
                <span className="report__progress-label">
                  Skill Coverage: {c.matchedSkills.length}/
                  {c.matchedSkills.length + c.missingSkills.length}
                </span>
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{
                      width: `${
                        (c.matchedSkills.length /
                          (c.matchedSkills.length + c.missingSkills.length)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="report__actions">
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/upload-resume')}
          >
            ← Back
          </button>
          <button
            id="start-over-btn"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            ↻ Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
