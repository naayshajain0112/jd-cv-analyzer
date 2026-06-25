import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { approveJD, generateCriteria } from '../api';
import PageHeader from '../components/PageHeader';
import './ReviewJD.css';
const ChipList = ({ items, onRemove, color }) => (
    <div className="chip-list">
      {items.map((item) => (
        <span className={`chip ${color || ''}`} key={item}>
          {item}
          <button className="chip__remove" onClick={() => onRemove(item)} aria-label={`Remove ${item}`}>×</button>
        </span>
      ))}
    </div>
  );

  const AddRow = ({ value, onChange, onAdd, onKeyDown, placeholder }) => (
    <div className="review-jd__add-skill">
      <input
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
      />
      <button className="btn btn-secondary" onClick={onAdd}>+ Add</button>
    </div>
  );
export default function ReviewJD() {
  const navigate  = useNavigate();
  const { state } = useLocation();
  const jdId      = state?.jdId;
  const rawText   = state?.rawText || '';

  const initial = state?.extracted || {};

  const [jobTitle, setJobTitle]           = useState(initial.jobTitle || '');
  const [experience, setExperience]       = useState(initial.experience || '');
  const [education, setEducation]         = useState(initial.education || '');
  const [location, setLocation]           = useState(initial.location || '');
  const [workingModel, setWorkingModel]   = useState(initial.workingModel || '');
  const [hardSkills, setHardSkills]       = useState(initial.hardSkills || []);
  const [softSkills, setSoftSkills]       = useState(initial.softSkills || []);
  const [mandatory, setMandatory]         = useState(initial.mandatoryRequirements || []);
  const [rejectConds, setRejectConds]     = useState(initial.rejectConditions || []);

  const [newHard, setNewHard] = useState('');
  const [newSoft, setNewSoft] = useState('');
  const [newMandatory, setNewMandatory] = useState('');
  const [newReject, setNewReject] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  if (!jdId) {
    return (
      <div className="page"><div className="container">
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No JD data found. <button className="btn btn-primary" onClick={() => navigate('/')}>Go back to Step 1</button></p>
        </div>
      </div></div>
    );
  }

  const addToList = (list, setList, val, setVal) => {
    const t = val.trim();
    if (t && !list.includes(t)) { setList([...list, t]); setVal(''); }
  };
  const removeFromList = (list, setList, item) => setList(list.filter((x) => x !== item));

  const handleContinue = async () => {
    setError('');
    setLoading(true);
    try {
      const extracted = {
        jobTitle, experience, education, location, workingModel,
        hardSkills, softSkills,
        mandatoryRequirements: mandatory,
        rejectConditions: rejectConds,
      };
      await approveJD(jdId, extracted);
      const criteriaResult = await generateCriteria(jdId);
      navigate('/upload-resume', {
        state: { jdId, extracted, criteria: criteriaResult.criteria },
      });
    } catch (err) {
      setError(err.message || 'Failed to save JD. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="page">
      <div className="container">
        <PageHeader
          step="Step 2"
          title="Review Extracted Requirements"
          subtitle="Verify and fine-tune the AI-extracted requirements before matching."
        />

        {rawText && (
          <details className="glass-card review-jd__preview">
            <summary className="review-jd__preview-toggle">📄 Original Job Description</summary>
            <p className="review-jd__preview-text">{rawText}</p>
          </details>
        )}

        <div className="glass-card review-jd__card">
          {/* Job Title */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">💼 Job Title</h2>
            <div className="form-group">
              <input id="job-title-input" className="form-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Full-Stack Engineer" />
            </div>
          </div>

          {/* Experience */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">📅 Experience Required</h2>
            <div className="form-group">
              <input id="experience-input" className="form-input" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 3+ years" />
            </div>
          </div>

          {/* Education */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">🎓 Education</h2>
            <div className="form-group">
              <input id="education-input" className="form-input" value={education} onChange={(e) => setEducation(e.target.value)} placeholder="e.g. Bachelor's in CS or related field" />
            </div>
          </div>

          {/* Location & Working Model */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">📍 Location & Working Model</h2>
            <div className="form-group" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input className="form-input" style={{ flex: 1 }} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (city / Remote)" />
              <select className="form-input" style={{ flex: 1 }} value={workingModel} onChange={(e) => setWorkingModel(e.target.value)}>
                <option value="">Working Model</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
              </select>
            </div>
          </div>

          {/* Hard Skills */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">🛠️ Hard Skills (Technical)</h2>
            <ChipList items={hardSkills} onRemove={(s) => removeFromList(hardSkills, setHardSkills, s)} />
            <AddRow value={newHard} onChange={setNewHard} placeholder="Add a technical skill…"
              onAdd={() => addToList(hardSkills, setHardSkills, newHard, setNewHard)} />
          </div>

          {/* Soft Skills */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">🤝 Soft Skills</h2>
            <ChipList items={softSkills} onRemove={(s) => removeFromList(softSkills, setSoftSkills, s)} color="chip--accent" />
            <AddRow value={newSoft} onChange={setNewSoft} placeholder="Add a soft skill…"
              onAdd={() => addToList(softSkills, setSoftSkills, newSoft, setNewSoft)} />
          </div>

          {/* Mandatory Requirements */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">✅ Mandatory Requirements</h2>
            <div className="chip-list">
              {mandatory.map((item) => (
                <span className="chip chip--success" key={item}>
                  {item}
                  <button className="chip__remove" onClick={() => removeFromList(mandatory, setMandatory, item)}>×</button>
                </span>
              ))}
            </div>
            <AddRow value={newMandatory} onChange={setNewMandatory} placeholder="Add a mandatory requirement…"
              onAdd={() => addToList(mandatory, setMandatory, newMandatory, setNewMandatory)} />
          </div>

          {/* Reject Conditions */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">🚫 Reject Conditions</h2>
            <div className="chip-list">
              {rejectConds.map((item) => (
                <span className="chip chip--danger" key={item}>
                  {item}
                  <button className="chip__remove" onClick={() => removeFromList(rejectConds, setRejectConds, item)}>×</button>
                </span>
              ))}
            </div>
            <AddRow value={newReject} onChange={setNewReject} placeholder="Add a reject condition…"
              onAdd={() => addToList(rejectConds, setRejectConds, newReject, setNewReject)} />
          </div>

          {error && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.12)', borderRadius: '8px', color: 'var(--clr-danger, #ef4444)', fontSize: '0.9rem' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="review-jd__actions">
            <button className="btn btn-ghost" onClick={() => navigate('/')}>← Back</button>
            <button id="review-continue-btn" className="btn btn-primary" disabled={loading} onClick={handleContinue}>
              {loading ? '⏳ Saving & Generating Criteria…' : 'Continue to Resumes →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
