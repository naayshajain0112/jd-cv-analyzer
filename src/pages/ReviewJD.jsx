import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './ReviewJD.css';

/* Simulated AI-extracted requirements (placeholder) */
const placeholderSkills = [
  'React', 'Node.js', 'REST APIs', 'PostgreSQL', 'Docker',
  'CI/CD', 'Git', 'Agile', 'TypeScript',
];

export default function ReviewJD() {
  const navigate    = useNavigate();
  const { state }   = useLocation();
  const jdText      = state?.jdText || '';

  const [skills, setSkills]     = useState(placeholderSkills);
  const [newSkill, setNewSkill] = useState('');
  const [experience, setExperience] = useState('3+');
  const [education, setEducation]   = useState("Bachelor's in CS or related field");

  /* ---- Skill management ---- */
  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkill('');
    }
  };

  const removeSkill = (skill) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSkill(); }
  };

  /* ---- Proceed ---- */
  const handleContinue = () => {
    navigate('/upload-resume', {
      state: { jdText, requirements: { skills, experience, education } },
    });
  };

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div className="section-header">
          <p className="section-header__badge">✦ Step 2</p>
          <h1 className="section-header__title">Review Extracted Requirements</h1>
          <p className="section-header__subtitle">
            Verify and fine-tune the AI-extracted requirements before matching.
          </p>
        </div>

        {/* JD Preview */}
        {jdText && (
          <details className="glass-card review-jd__preview" open>
            <summary className="review-jd__preview-toggle">
              📄 Original Job Description
            </summary>
            <p className="review-jd__preview-text">{jdText}</p>
          </details>
        )}

        {/* Requirements Card */}
        <div className="glass-card review-jd__card">
          {/* Skills */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">🛠️ Required Skills</h2>
            <div className="chip-list">
              {skills.map((skill) => (
                <span className="chip" key={skill}>
                  {skill}
                  <button
                    className="chip__remove"
                    onClick={() => removeSkill(skill)}
                    aria-label={`Remove ${skill}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="review-jd__add-skill">
              <input
                id="add-skill-input"
                className="form-input"
                placeholder="Add a skill…"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                id="add-skill-btn"
                className="btn btn-secondary"
                onClick={addSkill}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Experience */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">📅 Experience</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="experience-input">
                Minimum Years
              </label>
              <input
                id="experience-input"
                className="form-input"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              />
            </div>
          </div>

          {/* Education */}
          <div className="review-jd__section">
            <h2 className="review-jd__section-title">🎓 Education</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="education-input">
                Required Education
              </label>
              <input
                id="education-input"
                className="form-input"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="review-jd__actions">
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/')}
            >
              ← Back
            </button>
            <button
              id="review-continue-btn"
              className="btn btn-primary"
              onClick={handleContinue}
            >
              Continue to Resumes →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
