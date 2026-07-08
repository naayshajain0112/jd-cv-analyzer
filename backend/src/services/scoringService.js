/**
 * SCORING ENGINE
 * All scoring is done in code — Gemini only provides 1–5 ratings.
 * Weighted Score = sum(rating * weight) / (5 * totalWeight) * 100
 *
 * Classification:
 * 85–100 = Strong Fit
 * 70–84  = Moderate Fit
 * 50–69  = Weak Fit
 * < 50   = Reject
 */

/**
 * Calculate the weighted score for a set of skill ratings.
 * @param {Array} ratings - [{ skill, rating, weight }]
 * @param {number} totalWeight - Sum of all weights in this category
 * @returns {number} Score normalized to 100
 */
function calcCategoryScore(ratings, totalWeight) {
  if (!ratings || ratings.length === 0 || totalWeight === 0) return 0;

  const earned = ratings.reduce((sum, r) => {
    const rating = Math.min(5, Math.max(1, Number(r.rating) || 1));
    const weight = Number(r.weight) || 0;
    return sum + rating * weight;
  }, 0);

  const maxPossible = 5 * totalWeight;
  return Math.round((earned / maxPossible) * 100);
}

/**
 * Calculate the final weighted score combining hard and soft skills.
 * Hard skills = 70% of total, soft skills = 30% of total.
 *
 * @param {Array} hardRatings - Hard skill ratings with weights
 * @param {Array} softRatings - Soft skill ratings with weights
 * @returns {{ hardSkillScore, softSkillScore, weightedScore, classification }}
 */
function calculateScore(hardRatings, softRatings) {
  const hardTotalWeight = hardRatings.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 70;
  const softTotalWeight = softRatings.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 30;

  const hardScore = calcCategoryScore(hardRatings, hardTotalWeight);
  const softScore = calcCategoryScore(softRatings, softTotalWeight);

  // Weighted combination: hard=70%, soft=30%
  const weightedScore = Math.round(hardScore * 0.7 + softScore * 0.3);

  return {
    hardSkillScore: hardScore,
    softSkillScore: softScore,
    weightedScore,
    classification: classify(weightedScore),
  };
}

/**
 * Classify a score into a verdict.
 */
function classify(score) {
  if (score >= 85) return 'Strong Fit';
  if (score >= 70) return 'Moderate Fit';
  if (score >= 50) return 'Weak Fit';
  return 'Reject';
}

/**
 * Run eligibility checks against JD requirements.
 * @param {object} eligibilityChecks - From Gemini CV assessment
 * @param {object} approvedJD - Approved JD with requirements
 * @returns {object} Eligibility result with failure reasons
 */
function runEligibilityChecks(eligibilityChecks, approvedJD) {
  const failureReasons = [];

  const experienceMet = eligibilityChecks.experienceMet !== false;
  const educationMet = eligibilityChecks.educationMet !== false;
  const locationMet = eligibilityChecks.locationMet !== false;

  if (!experienceMet) {
    failureReasons.push(
      `Insufficient experience. Required: ${formatExperienceRequirement(approvedJD.experience)}. Found: ${eligibilityChecks.experienceYears || 'Not mentioned'}`
    );
  }

  if (!educationMet) {
    failureReasons.push(
      `Education requirement not met. Required: ${approvedJD.education || 'Not specified'}. Found: ${eligibilityChecks.educationFound || 'Not mentioned'}`
    );
  }

  if (!locationMet && approvedJD.location && approvedJD.location.toLowerCase() !== 'remote') {
    failureReasons.push(
      `Location mismatch. Required: ${approvedJD.location}. Candidate location: ${eligibilityChecks.locationFound || 'Not mentioned'}`
    );
  }

  // Mandatory requirements
  const mandatoryResults = eligibilityChecks.mandatoryCheckResults || [];
  const mandatoryMet = mandatoryResults.every((r) => r.met !== false);
  mandatoryResults.forEach((r) => {
    if (!r.met) failureReasons.push(`Mandatory requirement not met: ${r.requirement}`);
  });

  // Reject conditions
  const rejectResults = eligibilityChecks.rejectFlagResults || [];
  const noRejectFlags = rejectResults.every((r) => !r.flagged);
  rejectResults.forEach((r) => {
    if (r.flagged) failureReasons.push(`Reject condition triggered: ${r.condition}`);
  });

  const overallEligible = experienceMet && educationMet && mandatoryMet && noRejectFlags;

  return {
    experienceMet,
    educationMet,
    locationMet,
    mandatoryMet,
    noRejectFlags,
    failureReasons,
    overallEligible,
    details: eligibilityChecks,
  };
}

function formatExperienceRequirement(experience) {
  if (!experience) return 'Not specified';
  if (typeof experience === 'string') return experience;

  const minimum = Number(experience.minimum);
  if (Number.isFinite(minimum)) return `${minimum}+ years`;

  return 'Not specified';
}

/**
 * Identify skill gaps (skills rated 1) and weak skills (rated 2).
 */
function identifyGaps(hardRatings, softRatings) {
  const allRatings = [...hardRatings, ...softRatings];
  const gaps = allRatings.filter((r) => r.rating <= 1).map((r) => r.skill);
  const weak = allRatings.filter((r) => r.rating === 2).map((r) => r.skill);
  return { gaps, weak };
}

module.exports = { calculateScore, runEligibilityChecks, identifyGaps, classify };
