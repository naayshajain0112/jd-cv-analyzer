import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractJDText, extractJDFile } from '../api';
import './UploadJD.css';

const MODES = { PASTE: 'paste', UPLOAD: 'upload' };

export default function UploadJD() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [mode, setMode]             = useState(MODES.PASTE);
  const [jdText, setJdText]         = useState('');
  const [file, setFile]             = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [savedJDs, setSavedJDs]     = useState([]);
  const [selectedJD, setSelectedJD] = useState('');
  const [savedJDsLoading, setSavedJDsLoading] = useState(false);
  const [savedJDsError, setSavedJDsError] = useState('');
  const [selectedJDLoading, setSelectedJDLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchSavedJDs = async () => {
      setSavedJDsLoading(true);
      setSavedJDsError('');

      try {
        const response = await fetch('http://localhost:5000/api/jd', {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load saved JDs.');
        }

        setSavedJDs(Array.isArray(data.jds) ? data.jds : []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSavedJDsError(err.message || 'Failed to load saved JDs.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setSavedJDsLoading(false);
        }
      }
    };

    fetchSavedJDs();

    return () => controller.abort();
  }, []);

  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragIn  = (e) => { prevent(e); setIsDragging(true);  };
  const handleDragOut = (e) => { prevent(e); setIsDragging(false); };

  const handleDrop = (e) => {
    prevent(e);
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const handleFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    e.target.value = '';
  };

  const clearFile = () => setFile(null);

  const formatSize = (bytes) => {
    if (bytes < 1024)    return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const canSubmit = mode === MODES.PASTE ? jdText.trim().length > 50 : !!file;

  const handleAnalyze = async () => {
    if (!canSubmit || loading) return;
    setError('');
    setLoading(true);
    try {
      let result;
      if (mode === MODES.PASTE) {
        result = await extractJDText(jdText);
      } else {
        result = await extractJDFile(file);
      }
      navigate('/review', {
        state: {
          jdId: result.jdId,
          extracted: result.extracted,
          rawText: result.rawText || jdText,
        },
      });
    } catch (err) {
      setError(err.message || 'Failed to analyze JD. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseSelectedJD = async () => {
    if (!selectedJD || selectedJDLoading) return;

    setError('');
    setSavedJDsError('');
    setSelectedJDLoading(true);

    try {
      const response = await fetch(`http://localhost:5000/api/jd/${selectedJD}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.jd) {
        throw new Error(data.error || 'Failed to load the selected JD.');
      }

      navigate('/review', {
        state: {
          jdId: data.jd._id,
          extracted: data.jd.extracted,
          rawText: data.jd.rawText,
        },
      });
    } catch (err) {
      setSavedJDsError(err.message || 'Failed to load the selected JD.');
    } finally {
      setSelectedJDLoading(false);
    }
  };

  const renderPasteMode = () => (
    <div className="upload-jd__panel" key="paste">
      <div className="form-group">
        <label className="form-label" htmlFor="jd-textarea">Job Description Text</label>
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
        <span className="upload-jd__char-count">{jdText.length.toLocaleString()} characters</span>
        {jdText.length > 0 && (
          <button className="btn btn-ghost btn--sm" onClick={() => setJdText('')}>Clear</button>
        )}
      </div>
    </div>
  );

  const renderUploadMode = () => (
    <div className="upload-jd__panel" key="upload">
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
        <p className="dropzone__hint">Supports .pdf, .doc, .docx, .txt</p>
      </div>

      {file && (
        <div className="upload-jd__file-card">
          <span className="upload-jd__file-icon">📄</span>
          <div className="upload-jd__file-info">
            <span className="upload-jd__file-name">{file.name}</span>
            <span className="upload-jd__file-size">{formatSize(file.size)}</span>
          </div>
          <button className="chip__remove" onClick={clearFile} aria-label="Remove file">×</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="container">
        <div className="section-header">
          <p className="section-header__badge">✦ Step 1</p>
          <h1 className="section-header__title">Upload Job Description</h1>
          <p className="section-header__subtitle">
            Provide the job description to begin AI-powered requirement extraction.
          </p>
        </div>

        <div className="glass-card upload-jd__card">
          <div className="saved-jds">
            <h3>📚 Previously Uploaded JDs</h3>
            <div className="saved-jds__controls">
              <select
                className="form-select"
                value={selectedJD}
                onChange={(e) => setSelectedJD(e.target.value)}
                disabled={savedJDsLoading || selectedJDLoading}
              >
                <option value="">
                  {savedJDsLoading ? 'Loading saved JDs...' : 'Select a saved JD'}
                </option>
                {savedJDs.map((jd) => (
                  <option key={jd._id} value={jd._id}>{jd.title}</option>
                ))}
              </select>
              <button
                className="btn btn-ghost"
                disabled={!selectedJD || selectedJDLoading}
                onClick={handleUseSelectedJD}
              >
                {selectedJDLoading ? 'Loading...' : 'Use Selected JD'}
              </button>
            </div>
            {savedJDsError && (
              <p className="saved-jds__error">{savedJDsError}</p>
            )}
          </div>

          <div className="upload-jd__tabs" role="tablist">
            <button
              id="tab-paste"
              role="tab"
              aria-selected={mode === MODES.PASTE}
              className={`upload-jd__tab ${mode === MODES.PASTE ? 'upload-jd__tab--active' : ''}`}
              onClick={() => setMode(MODES.PASTE)}
            >✏️ Paste JD</button>
            <button
              id="tab-upload"
              role="tab"
              aria-selected={mode === MODES.UPLOAD}
              className={`upload-jd__tab ${mode === MODES.UPLOAD ? 'upload-jd__tab--active' : ''}`}
              onClick={() => setMode(MODES.UPLOAD)}
            >📎 Upload File</button>
            <span
              className="upload-jd__tab-indicator"
              style={{ transform: mode === MODES.UPLOAD ? 'translateX(100%)' : 'translateX(0)' }}
            />
          </div>

          {mode === MODES.PASTE ? renderPasteMode() : renderUploadMode()}

          {error && (
            <div className="alert alert-error" style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.12)', borderRadius: '8px', color: 'var(--clr-danger, #ef4444)', fontSize: '0.9rem' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="upload-jd__actions">
            <button
              id="jd-analyze-btn"
              className="btn btn-primary"
              disabled={!canSubmit || loading}
              onClick={handleAnalyze}
            >
              {loading ? '⏳ Analyzing…' : '⚡ Analyze JD'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
