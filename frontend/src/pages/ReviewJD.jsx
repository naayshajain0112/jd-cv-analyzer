import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { approveJD, generateCriteria } from '../api';
import PageHeader from '../components/PageHeader';
import './ReviewJD.css';

const parseExperienceMinimum = (experience) => {
  if (experience && typeof experience === 'object') {
    const minimum = Number(experience.minimum);
    return Number.isFinite(minimum) ? String(minimum) : '';
  }

  const match = String(experience || '').match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : '';
};

const createSkillGroup = () => ({
  id: `skill-group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  groupName: '',
  skills: [],
  rule: 'ALL',
});

const normalizeSkillGroups = (groups) => {
  if (!Array.isArray(groups)) return [];

  return groups.map((group, index) => ({
    id: group?.id || `skill-group-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    groupName: group?.groupName || '',
    skills: Array.isArray(group?.skills) ? [...new Set(group.skills.filter(Boolean))] : [],
    rule: group?.rule === 'ANY_ONE' ? 'ANY_ONE' : 'ALL',
  }));
};

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

  const [jobTitle, setJobTitle]             = useState(initial.jobTitle || '');
  const [experienceMinimum, setExperienceMinimum] = useState(parseExperienceMinimum(initial.experience));
  const [education, setEducation]           = useState(initial.education || '');
  const [location, setLocation]             = useState(initial.location || '');
  const [workingModel, setWorkingModel]     = useState(initial.workingModel || '');
  const [hardSkills, setHardSkills]         = useState(initial.hardSkills || []);
  const [skillGroups, setSkillGroups]       = useState(normalizeSkillGroups(initial.skillGroups));
  const [softSkills, setSoftSkills]         = useState(initial.softSkills || []);
  const [mandatory, setMandatory]           = useState(initial.mandatoryRequirements || []);
  const [rejectConds, setRejectConds]       = useState(initial.rejectConditions || []);

  const [newHard, setNewHard] = useState('');
  const [newSoft, setNewSoft] = useState('');
  const [newMandatory, setNewMandatory] = useState('');
  const [newReject, setNewReject] = useState('');
  const [newGroupSkills, setNewGroupSkills] = useState({});

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

  const addSkillGroup = () => {
    const group = createSkillGroup();
    setSkillGroups((prev) => [...prev, group]);
    setNewGroupSkills((prev) => ({ ...prev, [group.id]: '' }));
  };

  const updateSkillGroup = (groupId, updates) => {
    setSkillGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, ...updates } : group)));
  };

  const removeSkillGroup = (groupId) => {
    setSkillGroups((prev) => prev.filter((group) => group.id !== groupId));
    setNewGroupSkills((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  };

  const addSkillToGroup = (groupId) => {
    const selectedSkill = (newGroupSkills[groupId] || '').trim();
    if (!selectedSkill) return;

    setSkillGroups((prev) => prev.map((group) => {
      if (group.id !== groupId || group.skills.includes(selectedSkill)) return group;
      return { ...group, skills: [...group.skills, selectedSkill] };
    }));

    setNewGroupSkills((prev) => ({ ...prev, [groupId]: '' }));
  };

  const removeSkillFromGroup = (groupId, skill) => {
    setSkillGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group;
      return { ...group, skills: group.skills.filter((item) => item !== skill) };
    }));
  };

  const buildExperience = () => ({
    minimum: Number(experienceMinimum) || 0,
    allowHigherExperience: true,
  });

  const buildSkillGroups = () => skillGroups
    .map((group) => ({
      ...group,
      groupName: group.groupName.trim(),
      skills: group.skills.filter(Boolean),
      rule: group.rule === 'ANY_ONE' ? 'ANY_ONE' : 'ALL',
    }))
    .filter((group) => group.groupName || group.skills.length > 0);

  const handleContinue = async () => {
    setError('');
    setLoading(true);
    try {
      const normalizedExtracted = {
        jobTitle,
        education,
        location,
        workingModel,
        hardSkills,
        softSkills,
        mandatoryRequirements: mandatory,
        rejectConditions: rejectConds,
        experience: buildExperience(),
        skillGroups: buildSkillGroups(),
      };

      await approveJD(jdId, normalizedExtracted);
      const criteriaResult = await generateCriteria(jdId);
      navigate('/upload-resume', {
        state: { jdId, extracted: normalizedExtracted, criteria: criteriaResult.criteria },
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
            <h2 className="review-jd__section-title">📅 Minimum Experience Required (Years)</h2>
            <div className="form-group">
              <input
                id="experience-input"
                className="form-input"
                type="number"
                min="0"
                step="0.5"
                value={experienceMinimum}
                onChange={(e) => setExperienceMinimum(e.target.value)}
                placeholder="e.g. 3"
              />
              <p className="review-jd__helper-text">Higher experience is accepted automatically.</p>
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

          {/* Skill Groups */}
          <div className="review-jd__section">
            <div className="review-jd__section-header">
              <h2 className="review-jd__section-title">🧩 Skill Groups (Optional)</h2>
              <button className="btn btn-secondary" onClick={addSkillGroup}>+ Add Skill Group</button>
            </div>
            <p className="review-jd__helper-text">Use skill groups when a candidate only needs one of several equivalent skills.</p>

            {skillGroups.length === 0 ? (
              <p className="review-jd__empty-state">No skill groups added yet.</p>
            ) : skillGroups.map((group) => (
              <div className="review-jd__skill-group" key={group.id}>
                <div className="review-jd__skill-group-top">
                  <input
                    className="form-input"
                    value={group.groupName}
                    onChange={(e) => updateSkillGroup(group.id, { groupName: e.target.value })}
                    placeholder="Frontend Framework"
                  />
                  <button className="btn btn-ghost" onClick={() => removeSkillGroup(group.id)}>Remove Group</button>
                </div>

                <div className="review-jd__skill-group-rule">
                  <label className="review-jd__radio-option">
                    <input
                      type="radio"
                      name={`skill-group-rule-${group.id}`}
                      checked={group.rule === 'ALL'}
                      onChange={() => updateSkillGroup(group.id, { rule: 'ALL' })}
                    />
                    <span>ALL skills required</span>
                  </label>
                  <label className="review-jd__radio-option">
                    <input
                      type="radio"
                      name={`skill-group-rule-${group.id}`}
                      checked={group.rule === 'ANY_ONE'}
                      onChange={() => updateSkillGroup(group.id, { rule: 'ANY_ONE' })}
                    />
                    <span>ANY ONE skill required</span>
                  </label>
                </div>

                <div className="review-jd__skill-group-add">
                  <select
                    className="form-input"
                    value={newGroupSkills[group.id] || ''}
                    onChange={(e) => setNewGroupSkills((prev) => ({ ...prev, [group.id]: e.target.value }))}
                    disabled={hardSkills.length === 0}
                  >
                    <option value="">{hardSkills.length > 0 ? 'Add an existing hard skill' : 'Add hard skills first'}</option>
                    {hardSkills.map((skill) => (
                      <option key={skill} value={skill}>{skill}</option>
                    ))}
                  </select>
                  <button className="btn btn-secondary" onClick={() => addSkillToGroup(group.id)} disabled={hardSkills.length === 0}>
                    + Add
                  </button>
                </div>

                <ChipList
                  items={group.skills}
                  onRemove={(skill) => removeSkillFromGroup(group.id, skill)}
                  color="chip--accent"
                />
              </div>
            ))}
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
