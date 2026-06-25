import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAssessment, getJD, overrideAssessment, getReportPDFUrl } from '../api';
import PageHeader from '../components/PageHeader';
import './Report.css';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function verdictClass(v) {
  if (!v) return '';
  if (v.includes('Strong')) return 'badge-success';
  if (v.includes('Moderate')) return 'badge-warning';
  if (v.includes('Weak')) return 'badge-warning';
  return 'badge-danger';
}

function scoreColor(score) {
  if (score >= 70) return 'var(--clr-success)';
  if (score >= 50) return 'var(--clr-warning)';
  return 'var(--clr-danger)';
}

function ScoreRing({ score }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="score-ring">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={scoreColor(score)} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <span className="score-ring__label">{score}</span>
    </div>
  );
}

function RatingBar({ rating, max = 5 }) {
  const pct = (rating / max) * 100;
  const clr = rating >= 4 ? 'var(--clr-success)' : rating >= 3 ? 'var(--clr-warning)' : 'var(--clr-danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
      <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: '999px', height: '6px' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: clr, transition: 'width .6s ease' }} />
      </div>
      <span style={{ color: clr, fontWeight: 700, minWidth: '2.5rem' }}>{rating}/5</span>
    </div>
  );
}

function sanitizeFilename(value) {
  return String(value || 'Candidate')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    || 'Candidate';
}

/* ── Override Modal ─────────────────────────────────────────────────────── */
function OverrideModal({ assessment, onSave, onClose }) {
  const current = assessment.recruiterOverride || {};
  const [score, setScore]     = useState(current.overrideScore ?? assessment.scoring?.weightedScore ?? 0);
  const [verdict, setVerdict] = useState(current.overrideVerdict || assessment.scoring?.classification || '');
  const [notes, setNotes]     = useState(current.notes || '');
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ overrideScore: Number(score), overrideVerdict: verdict, notes });
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 700 }}>✏️ Recruiter Override — {assessment.candidateName}</h3>
        <div className="form-group">
          <label className="form-label">Override Score (0–100)</label>
          <input className="form-input" type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Override Verdict</label>
          <select className="form-input" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
            <option value="Strong Fit">Strong Fit</option>
            <option value="Moderate Fit">Moderate Fit</option>
            <option value="Weak Fit">Weak Fit</option>
            <option value="Reject">Reject</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Recruiter Notes</label>
          <textarea className="form-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add your observations, context, or reasoning…" />
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Override'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Candidate Card ─────────────────────────────────────────────────────── */
function CandidateCard({ assessment, jd, onOverrideSaved }) {
  const [expanded, setExpanded]   = useState(false);
  const [showModal, setShowModal] = useState(false);

  const scoring   = assessment.scoring || {};
  const override  = assessment.recruiterOverride;
  const finalScore   = override?.overrideScore   ?? scoring.weightedScore   ?? 0;
  const finalVerdict = override?.overrideVerdict ?? scoring.classification  ?? 'N/A';
  const eligibility  = assessment.eligibility    || {};
  const hardRatings  = assessment.hardSkillRatings || [];
  const softRatings  = assessment.softSkillRatings || [];
  const interviewQs  = assessment.interviewQuestions || [];
  const gaps = [...hardRatings, ...softRatings].filter((r) => r.rating <= 1).map((r) => r.skill);
  const weak = [...hardRatings, ...softRatings].filter((r) => r.rating === 2).map((r) => r.skill);

  const handleSave = async (data) => {
    try {
      const res = await overrideAssessment(assessment._id, data);
      onOverrideSaved(assessment._id, res.assessment.recruiterOverride);
      setShowModal(false);
    } catch (e) {
      alert('Failed to save override: ' + e.message);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(getReportPDFUrl(assessment._id));
      if (!res.ok) throw new Error(`PDF download failed (${res.status})`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFilename(assessment.candidateName)}_Assessment_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message || 'Failed to download PDF.');
    }
  };

  return (
    <div className="glass-card report__candidate">
      {/* Header */}
      <div className="report__candidate-header">
        <div>
          <h2 className="report__candidate-name">{assessment.candidateName}</h2>
          <p className="report__candidate-file">{assessment.resumeFileName}</p>
          {override?.notes && <p style={{ fontSize: '0.8rem', color: 'var(--clr-warning)', marginTop: '0.25rem' }}>📝 Recruiter override applied</p>}
        </div>
        <ScoreRing score={finalScore} />
      </div>

      <div className="report__candidate-meta">
        <span className={`badge ${verdictClass(finalVerdict)}`}>{finalVerdict}</span>
        <span className={`badge ${eligibility.overallEligible ? 'badge-success' : 'badge-danger'}`}>
          {eligibility.overallEligible ? '✓ Eligible' : '✗ Not Eligible'}
        </span>
        <span className="badge badge-accent">Hard: {scoring.hardSkillScore ?? 0}%</span>
        <span className="badge badge-accent">Soft: {scoring.softSkillScore ?? 0}%</span>
      </div>

      {/* Eligibility failures */}
      {!eligibility.overallEligible && eligibility.failureReasons?.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--clr-danger, #ef4444)', marginBottom: '1rem' }}>
          <strong>Rejection Reasons:</strong>
          <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
            {eligibility.failureReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* Skill bars summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', marginBottom: '1rem' }}>
        {hardRatings.slice(0, 6).map((r) => (
          <div key={r.skill}>
            <div style={{ fontSize: '0.75rem', color: 'var(--clr-muted)', marginBottom: '2px' }}>{r.skill}</div>
            <RatingBar rating={r.rating} />
          </div>
        ))}
      </div>

      {/* Gaps */}
      {gaps.length > 0 && (
        <div className="report__skills-group">
          <h3 className="report__skills-title report__skills-title--missing">❌ Missing Skills</h3>
          <div className="chip-list">{gaps.map((s) => <span key={s} className="chip chip--danger">{s}</span>)}</div>
        </div>
      )}
      {weak.length > 0 && (
        <div className="report__skills-group">
          <h3 className="report__skills-title" style={{ color: 'var(--clr-warning)' }}>⚠️ Weak Skills</h3>
          <div className="chip-list">{weak.map((s) => <span key={s} className="chip" style={{ borderColor: 'var(--clr-warning)' }}>{s}</span>)}</div>
        </div>
      )}

      {/* Expandable details */}
      <button className="btn btn-ghost btn--sm" style={{ marginTop: '0.5rem' }} onClick={() => setExpanded(!expanded)}>
        {expanded ? '▲ Hide Details' : '▼ Show Full Assessment'}
      </button>

      {expanded && (
        <div style={{ marginTop: '1rem' }}>
          {/* Hard skills full table */}
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>🛠️ Hard Skills Detail</h3>
          {hardRatings.map((r) => (
            <div key={r.skill} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <strong style={{ fontSize: '0.85rem' }}>{r.skill}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--clr-muted)' }}>Weight: {r.weight}</span>
              </div>
              <RatingBar rating={r.rating} />
              {r.evidence && <p style={{ fontSize: '0.75rem', color: 'var(--clr-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>Evidence: {r.evidence}</p>}
              {r.reasoning && <p style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>{r.reasoning}</p>}
            </div>
          ))}

          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>🤝 Soft Skills Detail</h3>
          {softRatings.map((r) => (
            <div key={r.skill} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '0.85rem' }}>{r.skill}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--clr-muted)' }}>Weight: {r.weight}</span>
              </div>
              <RatingBar rating={r.rating} />
              {r.reasoning && <p style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>{r.reasoning}</p>}
            </div>
          ))}

          {/* Interview Questions */}
          {interviewQs.length > 0 && (
            <>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>❓ Suggested Interview Questions</h3>
              {interviewQs.map((q, i) => (
                <div key={i} style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', borderLeft: '3px solid var(--clr-primary, #6366f1)' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.25rem' }}>Q{i + 1}. {q.question}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--clr-muted)', fontStyle: 'italic' }}>Focus: {q.focus}</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}><strong>Expected:</strong> {q.expectedAnswer}</p>
                </div>
              ))}
            </>
          )}

          {/* Recruiter notes if any */}
          {override?.notes && (
            <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', marginTop: '0.75rem' }}>
              <strong style={{ fontSize: '0.85rem' }}>📝 Recruiter Notes:</strong>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{override.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn--sm" onClick={() => setShowModal(true)}>✏️ Override</button>
        <button className="btn btn-ghost btn--sm" onClick={handleDownloadPDF}>
          📄 Download PDF
        </button>
      </div>

      {showModal && (
        <OverrideModal
          assessment={{ ...assessment, recruiterOverride: override }}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

/* ── Report Page ─────────────────────────────────────────────────────────── */
export default function Report() {
  const navigate  = useNavigate();
  const { state } = useLocation();
  const jdId          = state?.jdId;
  const assessmentIds = state?.assessmentIds || [];

  const [assessments, setAssessments] = useState([]);
  const [jd, setJD]                   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  useEffect(() => {
    if (!jdId || assessmentIds.length === 0) { setLoading(false); return; }
    (async () => {
      try {
        const [jdResult, ...aResults] = await Promise.all([
          getJD(jdId),
          ...assessmentIds.map((id) => getAssessment(id)),
        ]);
        setJD(jdResult.jd);
        setAssessments(aResults.map((r) => r.assessment));
      } catch (e) {
        setError(e.message || 'Failed to load results.');
      } finally {
        setLoading(false);
      }
    })();
  }, [jdId]);

  const handleOverrideSaved = (assessmentId, newOverride) => {
    setAssessments((prev) =>
      prev.map((a) => a._id === assessmentId ? { ...a, recruiterOverride: newOverride } : a)
    );
  };

  const getEffectiveScore = (a) => a.recruiterOverride?.overrideScore ?? a.scoring?.weightedScore ?? 0;
  const sorted = [...assessments].sort((a, b) => getEffectiveScore(b) - getEffectiveScore(a));
  const strongCount = sorted.filter((a) => getEffectiveScore(a) >= 85).length;
  const avgScore = sorted.length
    ? Math.round(sorted.reduce((s, a) => s + getEffectiveScore(a), 0) / sorted.length)
    : 0;

  if (loading) {
    return (
      <div className="page"><div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ fontSize: '1.1rem' }}>⏳ Loading assessment results…</p>
      </div></div>
    );
  }

  if (error) {
    return (
      <div className="page"><div className="container">
        <div className="glass-card" style={{ padding: '2rem', color: 'var(--clr-danger)' }}>
          ⚠️ {error}
          <div style={{ marginTop: '1rem' }}><button className="btn btn-primary" onClick={() => navigate('/')}>Start Over</button></div>
        </div>
      </div></div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="page"><div className="container">
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No results found. <button className="btn btn-primary" onClick={() => navigate('/')}>Start Over</button></p>
        </div>
      </div></div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <PageHeader
          step="Step 4"
          title="Candidate Assessment Report"
          subtitle={(
            <>
              AI-powered analysis of <strong>{assessments.length} candidate{assessments.length > 1 ? 's' : ''}</strong>{' '}
              {jd?.extracted?.jobTitle ? `for ${jd.extracted.jobTitle}` : 'against the job requirements'}.
            </>
          )}
        />

        {/* Summary bar */}
        <div className="report__summary glass-card">
          <div className="report__summary-item">
            <span className="report__summary-value">{assessments.length}</span>
            <span className="report__summary-label">Candidates</span>
          </div>
          <div className="report__summary-divider" />
          <div className="report__summary-item">
            <span className="report__summary-value" style={{ color: 'var(--clr-success)' }}>{strongCount}</span>
            <span className="report__summary-label">Strong Fits</span>
          </div>
          <div className="report__summary-divider" />
          <div className="report__summary-item">
            <span className="report__summary-value">{avgScore}%</span>
            <span className="report__summary-label">Avg. Score</span>
          </div>
          <div className="report__summary-divider" />
          <div className="report__summary-item">
            <span className="report__summary-value" style={{ color: 'var(--clr-success)' }}>
              {sorted.filter((a) => (a.eligibility?.overallEligible)).length}
            </span>
            <span className="report__summary-label">Eligible</span>
          </div>
        </div>

        {/* Failed assessments notice */}
        {state?.results?.some((r) => !r.success) && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', fontSize: '0.88rem' }}>
            ⚠️ Some files could not be processed:{' '}
            {state.results.filter((r) => !r.success).map((r) => r.file).join(', ')}
          </div>
        )}

        {/* Candidate cards */}
        <div className="report__candidates">
          {sorted.map((a) => (
            <CandidateCard
              key={a._id}
              assessment={a}
              jd={jd}
              onOverrideSaved={handleOverrideSaved}
            />
          ))}
        </div>

        <div className="report__actions">
          <button className="btn btn-ghost" onClick={() => navigate('/upload-resume')}>← Back</button>
          <button id="start-over-btn" className="btn btn-secondary" onClick={() => navigate('/')}>↻ Start Over</button>
        </div>
      </div>
    </div>
  );
}
