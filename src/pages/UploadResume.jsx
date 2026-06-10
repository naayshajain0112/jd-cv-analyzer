import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './UploadResume.css';

export default function UploadResume() {
  const navigate        = useNavigate();
  const { state }       = useLocation();
  const fileRef         = useRef(null);

  const [files, setFiles]       = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  /* ---- Drag & Drop ---- */
  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

  const handleDragIn  = (e) => { prevent(e); setIsDragging(true);  };
  const handleDragOut = (e) => { prevent(e); setIsDragging(false); };

  const handleDrop = (e) => {
    prevent(e);
    setIsDragging(false);
    const incoming = Array.from(e.dataTransfer.files);
    addFiles(incoming);
  };

  const handleFileInput = (e) => {
    const incoming = Array.from(e.target.files);
    addFiles(incoming);
    e.target.value = '';           // allow re-selecting same files
  };

  const addFiles = (incoming) => {
    // De-duplicate by name
    const existing = new Set(files.map((f) => f.name));
    const newFiles = incoming.filter((f) => !existing.has(f.name));
    setFiles([...files, ...newFiles]);
  };

  const removeFile = (name) => {
    setFiles(files.filter((f) => f.name !== name));
  };

  /* ---- Format file size ---- */
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  /* ---- Analyze ---- */
  const handleAnalyze = () => {
    // In a real app, upload files + requirements to backend
    navigate('/report', {
      state: {
        ...state,
        resumeCount: files.length,
        resumeNames: files.map((f) => f.name),
      },
    });
  };

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div className="section-header">
          <p className="section-header__badge">✦ Step 3</p>
          <h1 className="section-header__title">Upload Candidate Resumes</h1>
          <p className="section-header__subtitle">
            Upload one or more resumes to match against the job requirements.
          </p>
        </div>

        <div className="glass-card upload-resume__card">
          {/* Dropzone */}
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
            <p className="dropzone__hint">
              Accepts .pdf, .doc, .docx, .txt — multiple files supported
            </p>
          </div>

          {/* File list */}
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
                    <span className="upload-resume__file-size">
                      {formatSize(f.size)}
                    </span>
                    <button
                      className="chip__remove"
                      onClick={() => removeFile(f.name)}
                      aria-label={`Remove ${f.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="upload-resume__actions">
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/review')}
            >
              ← Back
            </button>
            <button
              id="analyze-btn"
              className="btn btn-primary"
              disabled={files.length === 0}
              onClick={handleAnalyze}
            >
              ⚡ Analyze Candidates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
