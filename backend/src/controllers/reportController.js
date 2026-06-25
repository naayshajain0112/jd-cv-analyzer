const { generateReportPDF, resolveCandidateName } = require('../services/pdfService');
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

function sanitizeFilename(value) {
  return String(value || 'Candidate')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    || 'Candidate';
}

module.exports = { downloadPDF };
