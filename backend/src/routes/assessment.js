const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  assessCandidates,
  getAssessment,
  getAssessmentsByJD,
  overrideAssessment,
} = require('../controllers/assessmentController');

// Assess one or more CVs against a JD
router.post('/assess', upload.array('resumes', 20), assessCandidates);

// Get all assessments for a JD
router.get('/by-jd/:jdId', getAssessmentsByJD);

// Get single assessment
router.get('/:id', getAssessment);

// Recruiter override
router.put('/:id/override', overrideAssessment);

module.exports = router;
