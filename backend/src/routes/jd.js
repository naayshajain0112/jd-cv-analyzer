const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  extractJD,
  approveJD,
  generateCriteria,
  getJD,
  getAllJDs,
} = require('../controllers/jdController');

// Extract JD from text or file
router.post('/extract', upload.single('file'), extractJD);

// Get all JDs
router.get('/', getAllJDs);
router.get('/:id', getJD);

// Approve JD with optional edits
router.put('/:id/approve', approveJD);

// Generate assessment criteria
router.post('/:id/criteria', generateCriteria);

module.exports = router;
