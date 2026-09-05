/**
 * API service — all backend calls go through here.
 * In dev: Vite proxies /api → localhost:5000
 * In prod: set VITE_API_URL to your Render backend (e.g. https://xyz.onrender.com/api)
 */
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request(method, path, body, isFormData = false) {
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  const init = { method, headers };
  if (body) init.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, init);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function extractJDText(text) {
  const fd = new FormData();
  fd.append('text', text);
  return request('POST', '/jd/extract', fd, true);
}

export async function extractJDFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  return request('POST', '/jd/extract', fd, true);
}

export async function approveJD(jdId, extracted) {
  return request('PUT', `/jd/${jdId}/approve`, { extracted });
}

export async function generateCriteria(jdId) {
  return request('POST', `/jd/${jdId}/criteria`);
}

export async function getJD(jdId) {
  return request('GET', `/jd/${jdId}`);
}

export async function assessCandidates(jdId, files) {
  const fd = new FormData();
  fd.append('jdId', jdId);
  files.forEach((file) => fd.append('resumes', file));
  return request('POST', '/assessment/assess', fd, true);
}

export async function getAssessmentsByJD(jdId) {
  return request('GET', `/assessment/by-jd/${jdId}`);
}

export async function getAssessment(id) {
  return request('GET', `/assessment/${id}`);
}

export async function overrideAssessment(id, data) {
  return request('PUT', `/assessment/${id}/override`, data);
}

export function getReportPDFUrl(assessmentId) {
  return `${API_BASE}/report/${assessmentId}/pdf`;
}
