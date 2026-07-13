const { generateReportPDF, generateSummaryPDF, resolveCandidateName } = require('../services/pdfService');
const { Assessment, JD } = require('../models');
const { asyncHandler, createError } = require('../middleware/errorHandler');

/**
 * GET /api/report/:assessmentId/pdf
 * Generate and stream a PDF report for a single assessment.
 */
const downloadPDF = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.assessmentId);
  if (!assessment) throw createError('Assessment not found.', 404);

  const jd = await JD.findById(assessment.jdId);
  if (!jd) throw createError('JD not found.', 404);

  const pdfBuffer = await generateReportPDF(assessment, jd);

  const filename = `${sanitizeFilename(resolveCandidateName(assessment))}_Assessment_Report.pdf`;

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': pdfBuffer.length,
  });

  res.send(pdfBuffer);
});

/**
 * POST /api/report/summary/pdf
 * Generate and stream a summary PDF covering a specific set of assessments
 * (i.e. one assessment run for one JD). Body: { jdId, assessmentIds: [] }
 */
const downloadSummaryPDF = asyncHandler(async (req, res) => {
  const { jdId, assessmentIds } = req.body || {};

  if (!jdId) throw createError('jdId is required.', 400);
  if (!Array.isArray(assessmentIds) || assessmentIds.length === 0) {
    throw createError('assessmentIds is required.', 400);
  }

  const jd = await JD.findById(jdId);
  if (!jd) throw createError('JD not found.', 404);

  const assessments = await Assessment.find({
    _id: { $in: assessmentIds },
    jdId,
  });

  if (assessments.length === 0) throw createError('No assessments found for this run.', 404);

  const pdfBuffer = await generateSummaryPDF(assessments, jd);

  const filename = `${sanitizeFilename(jd?.extracted?.jobTitle || jd?.title || 'Assessment')}_Candidates_Summary.pdf`;

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': pdfBuffer.length,
  });

  res.send(pdfBuffer);
});

function sanitizeFilename(value) {
  return String(value || 'Candidate')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    || 'Candidate';
}

module.exports = { downloadPDF, downloadSummaryPDF };
