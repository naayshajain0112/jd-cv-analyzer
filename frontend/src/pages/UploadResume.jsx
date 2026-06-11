import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { assessCandidates } from '../api';
import './UploadResume.css';

export default function UploadResume() {
  const navigate        = useNavigate();
  const { state }       = useLocation();
  const fileRef         = useRef(null);

  const jdId    = state?.jdId;
  const [files, setFiles]           = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [progress, setProgress]     = useState('');
  const [error, setError]           = useState('');

  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragIn  = (e) => { prevent(e); setIsDragging(true);  };
  const handleDragOut = (e) => { prevent(e); setIsDragging(false); };

  const handleDrop = (e) => {
    prevent(e);
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInput = (e) => {
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const addFiles = (incoming) => {
    const existing = new Set(files.map((f) => f.name));
    const newFiles = incoming.filter((f) => !existing.has(f.name));
    setFiles([...files, ...newFiles]);
  };

  const removeFile = (name) => setFiles(files.filter((f) => f.name !== name));

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleAnalyze = async () => {
    if (files.length === 0 || loading) return;
    if (!jdId) {
      setError('JD session expired. Please start over.');
      return;
    }
    setError('');
    setLoading(true);
    setProgress(`Uploading and analyzing ${files.length} resume(s)… This may take a minute.`);
    try {
      const result = await assessCandidates(jdId, files);
      const assessmentIds = result.results
        .filter((r) => r.success)
        .map((r) => r.assessmentId);

      if (assessmentIds.length === 0) {
        throw new Error('All assessments failed. Check file formats and try again.');
      }

      navigate('/report', {
        state: { jdId, assessmentIds, results: result.results },
      });
    } catch (err) {
      setError(err.message || 'Assessment failed. Please try again.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="section-header">
          <p className="section-header__badge">✦ Step 3</p>
          <h1 className="section-header__title">Upload Candidate Resumes</h1>
          <p className="section-header__subtitle">
            Upload one or more resumes to match against the job requirements.
          </p>
        </div>

        <div className="glass-card upload-resume__card">
          <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={prevent}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              onChange={handleFileInput}
              hidden
              id="resume-file-input"
            />
            <div className="dropzone__icon">📎</div>
            <p className="dropzone__text">
              Drop resumes here or <strong>click to browse</strong>
            </p>
            <p className="dropzone__hint">Accepts .pdf, .doc, .docx, .txt — multiple files supported</p>
          </div>

          {files.length > 0 && (
            <div className="upload-resume__file-list">
              <p className="upload-resume__file-count">
                {files.length} resume{files.length > 1 ? 's' : ''} ready
              </p>
              <ul className="upload-resume__files">
                {files.map((f) => (
                  <li key={f.name} className="upload-resume__file-item">
                    <span className="upload-resume__file-icon">📄</span>
                    <span className="upload-resume__file-name">{f.name}</span>
                    <span className="upload-resume__file-size">{formatSize(f.size)}</span>
                    <button className="chip__remove" onClick={() => removeFile(f.name)} aria-label={`Remove ${f.name}`}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loading && progress && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.1)', borderRadius: '8px', color: 'var(--clr-primary, #6366f1)', fontSize: '0.9rem' }}>
              ⏳ {progress}
            </div>
          )}

          {error && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.12)', borderRadius: '8px', color: 'var(--clr-danger, #ef4444)', fontSize: '0.9rem' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="upload-resume__actions">
            <button className="btn btn-ghost" onClick={() => navigate('/review')} disabled={loading}>← Back</button>
            <button
              id="analyze-btn"
              className="btn btn-primary"
              disabled={files.length === 0 || loading}
              onClick={handleAnalyze}
            >
              {loading ? '⏳ Analyzing…' : '⚡ Analyze Candidates'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
