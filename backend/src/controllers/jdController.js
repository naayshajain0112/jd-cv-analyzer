const path = require('path');
const fs = require('fs');
const { extractText } = require('../services/extractionService');
const { callGemini } = require('../services/geminiService');
const { jdExtractionPrompt, assessmentCriteriaPrompt } = require('../prompts/jdPrompts');
const { JD } = require('../models');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

function normalizeExtractedJD(extracted = {}) {
  const minimum = parseExperienceMinimum(extracted.experience);

  return {
    ...extracted,
    experience: {
      minimum,
      allowHigherExperience: true,
    },
    hardSkills: Array.isArray(extracted.hardSkills) ? extracted.hardSkills : [],
    skillGroups: Array.isArray(extracted.skillGroups)
      ? extracted.skillGroups.map((group, index) => ({
        id: group?.id || `skill-group-${index + 1}`,
        groupName: group?.groupName || '',
        skills: Array.isArray(group?.skills) ? [...new Set(group.skills.filter(Boolean))] : [],
        rule: group?.rule === 'ANY_ONE' ? 'ANY_ONE' : 'ALL',
      }))
      : [],
    softSkills: Array.isArray(extracted.softSkills) ? extracted.softSkills : [],
    mandatoryRequirements: Array.isArray(extracted.mandatoryRequirements) ? extracted.mandatoryRequirements : [],
    rejectConditions: Array.isArray(extracted.rejectConditions) ? extracted.rejectConditions : [],
  };
}

function parseExperienceMinimum(experience) {
  if (experience && typeof experience === 'object') {
    const minimum = Number(experience.minimum);
    return Number.isFinite(minimum) ? minimum : 0;
  }

  const match = String(experience || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

/**
 * POST /api/jd/extract
 * Upload or paste JD text, extract structured requirements via Gemini.
 */
const extractJD = asyncHandler(async (req, res) => {
  let rawText = '';

  if (req.file) {
    // File upload — extract text from PDF/DOCX/TXT
    rawText = await extractText(req.file.path);
    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});
  } else if (req.body.text) {
    rawText = req.body.text.trim();
  }

  if (!rawText || rawText.length < 50) {
    throw createError('Job description text is too short or empty.', 400);
  }

  logger.info(`Extracting JD requirements from ${rawText.length} chars`);

  const extracted = normalizeExtractedJD(await callGemini(jdExtractionPrompt(rawText)));
  console.log('Job title:', extracted.jobTitle);
  // Persist to DB (unapproved)
  const jdDoc = await JD.create({
  title: extracted.jobTitle || 'Untitled JD',
  rawText,
  extracted,
  approved: false,
});

  res.json({
    success: true,
    jdId: jdDoc._id,
    extracted,
    rawText,
  });
});

/**
 * PUT /api/jd/:id/approve
 * Recruiter approves (and optionally edits) the extracted JD.
 */
const approveJD = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { extracted } = req.body;

  if (!extracted) throw createError('Extracted JD data is required.', 400);

  const normalizedExtracted = normalizeExtractedJD(extracted);

  const jd = await JD.findByIdAndUpdate(
    id,
    { extracted: normalizedExtracted, approved: true },
    { new: true }
  );

  if (!jd) throw createError('JD not found.', 404);

  res.json({ success: true, jd });
});

/**
 * POST /api/jd/:id/criteria
 * Generate assessment criteria with weights for an approved JD.
 */
const generateCriteria = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const jd = await JD.findById(id);
  if (!jd) throw createError('JD not found.', 404);
  if (!jd.approved) throw createError('JD must be approved before generating criteria.', 400);

  logger.info(`Generating assessment criteria for JD ${id}`);

  const criteria = await callGemini(assessmentCriteriaPrompt(jd.extracted));

  // Normalize weights to sum exactly to 70/30
  criteria.hardSkills = normalizeWeights(criteria.hardSkills, 70);
  criteria.softSkills = normalizeWeights(criteria.softSkills, 30);

  jd.assessmentCriteria = criteria;
  await jd.save();

  res.json({ success: true, criteria, jdId: id });
});

/**
 * GET /api/jd/:id
 * Fetch a JD by ID.
 */
const getJD = asyncHandler(async (req, res) => {
  const jd = await JD.findById(req.params.id);
  if (!jd) throw createError('JD not found.', 404);
  res.json({ success: true, jd });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize skill weights to exactly sum to targetTotal.
 */
function normalizeWeights(skills, targetTotal) {
  if (!skills || skills.length === 0) return skills;

  const currentSum = skills.reduce((s, sk) => s + (Number(sk.weight) || 0), 0);
  if (currentSum === 0) {
    // Equal distribution
    const perSkill = Math.floor(targetTotal / skills.length);
    skills.forEach((sk, i) => {
      sk.weight = i === skills.length - 1
        ? targetTotal - perSkill * (skills.length - 1)
        : perSkill;
    });
    return skills;
  }

  const factor = targetTotal / currentSum;
  let adjusted = skills.map((sk) => ({
    ...sk,
    weight: Math.round((Number(sk.weight) || 0) * factor),
  }));

  // Fix rounding drift
  const adjustedSum = adjusted.reduce((s, sk) => s + sk.weight, 0);
  if (adjustedSum !== targetTotal) {
    adjusted[0].weight += targetTotal - adjustedSum;
  }

  return adjusted;
}
const getAllJDs = asyncHandler(async (req, res) => {
  const jds = await JD.find()
    .sort({ createdAt: -1 })
    .select('_id title approved createdAt');

  res.json({
    success: true,
    jds,
  });
});
const deleteJD = asyncHandler(async (req, res) => {
  const jd = await JD.findByIdAndDelete(req.params.id);

  if (!jd) {
    throw createError('JD not found.', 404);
  }

  res.json({
    success: true,
    message: 'JD deleted successfully',
  });
});
module.exports = {
  extractJD,
  approveJD,
  generateCriteria,
  getJD,
  getAllJDs,
  deleteJD,
};