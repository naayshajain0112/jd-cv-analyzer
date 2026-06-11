const express = require('express');
const router = express.Router();
const { downloadPDF } = require('../controllers/reportController');

// Download PDF report for an assessment
router.get('/:assessmentId/pdf', downloadPDF);

module.exports = router;
