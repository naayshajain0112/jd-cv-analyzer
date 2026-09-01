const fs = require('fs');
const { extractText } = require('../services/extractionService');
const { callGemini } = require('../services/geminiService');
const { resolveCandidateName, extractResumeNameFromText, extractLinkedInNameFromText } = require('../services/pdfService');
const { cvAssessmentPrompt, interviewQuestionsPrompt } = require('../prompts/cvPrompts');
const { calculateScore, runEligibilityChecks, identifyGaps, deduplicateRatings } = require('../services/scoringService');
const { JD, Assessment } = require('../models');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * POST /api/assessment/assess
 * Upload one or more CVs and assess them against an approved JD.
 * Body: { jdId }
 * Files: one or more resume files (field name: "resumes")
 */
const assessCandidates = asyncHandler(async (req, res) => {
  const { jdId } = req.body;
  if (!jdId) throw createError('jdId is required.', 400);
  if (!req.files || req.files.length === 0) throw createError('At least one resume file is required.', 400);

  const jd = await JD.findById(jdId);
  if (!jd) throw createError('JD not found.', 404);
  if (!jd.approved) throw createError('JD must be approved first.', 400);
  if (!jd.assessmentCriteria) throw createError('Assessment criteria not generated yet.', 400);

  const results = [];

  for (const file of req.files) {
    try {
      logger.info(`Assessing CV: ${file.originalname}`);
      const cvText = await extractText(file.path);
      fs.unlink(file.path, () => {});

      // Gemini rates skills 1–5
      const aiResult = await callGemini(
        cvAssessmentPrompt(jd.extracted, jd.assessmentCriteria, cvText)
      );

      // Merge weights from criteria into ratings
      const hardRatings = mergeWeights(
        aiResult.hardSkillRatings || [],
        jd.assessmentCriteria.hardSkills || []
      );
      const softRatings = mergeWeights(
        aiResult.softSkillRatings || [],
        jd.assessmentCriteria.softSkills || []
      );

      // Backend scoring — no AI involvement
      const scoring = calculateScore(hardRatings, softRatings, jd.extracted || {}, jd.assessmentCriteria || {});
      const eligibility = runEligibilityChecks(
        aiResult.eligibilityChecks || {},
        jd.extracted || {}
      );

      // Identify gaps for interview questions
      const { gaps, weak } = identifyGaps(hardRatings, softRatings);

      // Generate interview questions
      const iqResult = await callGemini(
        interviewQuestionsPrompt(jd.extracted, gaps, weak)
      );
      const resumeName = meaningfulName(aiResult.resumeName) || extractResumeNameFromText(cvText);
      const linkedinName = meaningfulName(aiResult.linkedinName) || extractLinkedInNameFromText(cvText);
      const candidateName = resolveCandidateName({
        candidateName: aiResult.candidateName,
        resumeName,
        linkedinName,
        resumeText: cvText,
      });

      // Normalize/deduplicate skills to avoid redundant scoring and display
      const normalizedHardRatings = deduplicateRatings(hardRatings);
      const normalizedSoftRatings = deduplicateRatings(softRatings);

      const assessment = await Assessment.create({
        jdId,
        candidateName,
        resumeName,
        linkedinName,
        resumeFileName: file.originalname,
        resumeText: cvText.substring(0, 5000),
        hardSkillRatings: normalizedHardRatings,
        softSkillRatings: normalizedSoftRatings,
        eligibility,
        scoring,
        interviewQuestions: iqResult.questions || [],
      });

      results.push({ success: true, assessmentId: assessment._id, assessment });
    } catch (err) {
      logger.error(`Failed to assess ${file.originalname}: ${err.message}`);
      results.push({
        success: false,
        file: file.originalname,
        error: err.message,
      });
      fs.unlink(file.path, () => {});
    }
  }

  res.json({ success: true, results });
});

/**
 * GET /api/assessment/:id
 * Get a single assessment by ID.
 */
const getAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id).populate('jdId');
  if (!assessment) throw createError('Assessment not found.', 404);
  res.json({ success: true, assessment });
});

/**
 * GET /api/assessment/by-jd/:jdId
 * Get all assessments for a JD.
 */
const getAssessmentsByJD = asyncHandler(async (req, res) => {
  const assessments = await Assessment.find({ jdId: req.params.jdId })
    .select('-resumeText')
    .sort({ 'scoring.weightedScore': -1 });
  res.json({ success: true, assessments });
});

/**
 * PUT /api/assessment/:id/override
 * Recruiter override: custom score, verdict, notes.
 */
const overrideAssessment = asyncHandler(async (req, res) => {
  const { overrideScore, overrideVerdict, notes } = req.body;

  const assessment = await Assessment.findByIdAndUpdate(
    req.params.id,
    { recruiterOverride: { overrideScore, overrideVerdict, notes } },
    { new: true }
  );

  if (!assessment) throw createError('Assessment not found.', 404);
  res.json({ success: true, assessment });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merge weights from criteria into Gemini's ratings array.
 */
function mergeWeights(ratings, criteria) {
  return ratings.map((r) => {
    const criteriaItem = criteria.find(
      (c) => c.skill.toLowerCase() === r.skill.toLowerCase()
    );
    return {
      ...r,
      weight: criteriaItem?.weight || 0,
      importance: criteriaItem?.importance || 'important',
    };
  });
}

function meaningfulName(value) {
  if (!value) return '';
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  if (!cleaned || /^unknown$/i.test(cleaned) || /^n\/a$/i.test(cleaned) || cleaned === '-') return '';
  return cleaned;
}

module.exports = { assessCandidates, getAssessment, getAssessmentsByJD, overrideAssessment };
