import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './UploadJD.css';

const MODES = { PASTE: 'paste', UPLOAD: 'upload' };

export default function UploadJD() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [mode, setMode]             = useState(MODES.PASTE);
  const [jdText, setJdText]         = useState('');
  const [fileName, setFileName]     = useState('');
  const [fileSize, setFileSize]     = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  /* ---- Drag & Drop helpers ---- */
  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

  const handleDragIn  = (e) => { prevent(e); setIsDragging(true);  };
  const handleDragOut = (e) => { prevent(e); setIsDragging(false); };

  const handleDrop = (e) => {
    prevent(e);
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  /* ---- File reader ---- */
  const loadFile = (file) => {
    setFileName(file.name);
    setFileSize(file.size);
    const reader = new FileReader();
    reader.onload = (e) => setJdText(e.target.result);
    reader.readAsText(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  const clearFile = () => {
    setFileName('');
    setFileSize(0);
    setJdText('');
  };

  /* ---- Format helpers ---- */
  const formatSize = (bytes) => {
    if (bytes < 1024)    return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  /* ---- Submit ---- */
  const canSubmit = jdText.trim().length > 0;

  const handleAnalyze = () => {
    if (!canSubmit) return;
    // No backend call yet — just forward JD text to the review page
    navigate('/review', { state: { jdText } });
  };

  /* ---- Renderers ---- */
  const renderPasteMode = () => (
    <div className="upload-jd__panel" key="paste">
      <div className="form-group">
        <label className="form-label" htmlFor="jd-textarea">
          Job Description Text
        </label>
        <textarea
          id="jd-textarea"
          className="form-textarea"
          placeholder="Paste the full job description here…"
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={10}
        />
      </div>

      <div className="upload-jd__meta">
        <span className="upload-jd__char-count">
          {jdText.length.toLocaleString()} characters
        </span>
        {jdText.length > 0 && (
          <button className="btn btn-ghost btn--sm" onClick={() => setJdText('')}>
            Clear
          </button>
        )}
      </div>
    </div>
  );

  const renderUploadMode = () => (
    <div className="upload-jd__panel" key="upload">
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
          accept=".txt,.pdf,.doc,.docx"
          onChange={handleFileInput}
          hidden
          id="jd-file-input"
        />
        <div className="dropzone__icon">📁</div>
        <p className="dropzone__text">
          Drag & drop your file here, or <strong>click to browse</strong>
        </p>
        <p className="dropzone__hint">
          Supports .pdf, .doc, .docx, .txt
        </p>
      </div>

      {/* Loaded file card */}
      {fileName && (
        <div className="upload-jd__file-card">
          <span className="upload-jd__file-icon">📄</span>
          <div className="upload-jd__file-info">
            <span className="upload-jd__file-name">{fileName}</span>
            <span className="upload-jd__file-size">{formatSize(fileSize)}</span>
          </div>
          <button
            className="chip__remove"
            onClick={clearFile}
            aria-label="Remove file"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div className="section-header">
          <p className="section-header__badge">✦ Step 1</p>
          <h1 className="section-header__title">Upload Job Description</h1>
          <p className="section-header__subtitle">
            Provide the job description to begin AI-powered requirement extraction.
          </p>
        </div>

        {/* Card */}
        <div className="glass-card upload-jd__card">
          {/* Mode Tabs */}
          <div className="upload-jd__tabs" role="tablist">
            <button
              id="tab-paste"
              role="tab"
              aria-selected={mode === MODES.PASTE}
              className={`upload-jd__tab ${mode === MODES.PASTE ? 'upload-jd__tab--active' : ''}`}
              onClick={() => setMode(MODES.PASTE)}
            >
              ✏️ Paste JD
            </button>
            <button
              id="tab-upload"
              role="tab"
              aria-selected={mode === MODES.UPLOAD}
              className={`upload-jd__tab ${mode === MODES.UPLOAD ? 'upload-jd__tab--active' : ''}`}
              onClick={() => setMode(MODES.UPLOAD)}
            >
              📎 Upload File
            </button>
            {/* Active tab indicator */}
            <span
              className="upload-jd__tab-indicator"
              style={{ transform: mode === MODES.UPLOAD ? 'translateX(100%)' : 'translateX(0)' }}
            />
          </div>

          {/* Tab panel */}
          {mode === MODES.PASTE ? renderPasteMode() : renderUploadMode()}

          {/* Action bar */}
          <div className="upload-jd__actions">
            <button
              id="jd-analyze-btn"
              className="btn btn-primary"
              disabled={!canSubmit}
              onClick={handleAnalyze}
            >
              ⚡ Analyze JD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
