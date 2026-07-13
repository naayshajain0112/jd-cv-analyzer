const express = require('express');
const router = express.Router();
const { downloadPDF, downloadSummaryPDF } = require('../controllers/reportController');

// Download a summary PDF covering all candidates in one assessment run
router.post('/summary/pdf', downloadSummaryPDF);

// Download PDF report for an assessment
router.get('/:assessmentId/pdf', downloadPDF);

module.exports = router;
