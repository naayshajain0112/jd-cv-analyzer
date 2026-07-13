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
 * Skill groups are folded into the hard-skill score before remaining hard skills are scored individually.
 *
 * @param {Array} hardRatings - Hard skill ratings with weights
 * @param {Array} softRatings - Soft skill ratings with weights
 * @param {object} approvedJD - Approved JD containing skillGroups
 * @returns {{ hardSkillScore, softSkillScore, weightedScore, classification }}
 */
function calculateScore(hardRatings, softRatings, approvedJD = {}, assessmentCriteria = {}) {
  const softTotalWeight = softRatings.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 30;

  const hardScore = calcHardSkillScore(
    hardRatings,
    approvedJD.skillGroups || [],
    assessmentCriteria.hardSkills || []
  );
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
 * Calculate hard-skill score while folding skill groups into a single scored unit.
 */
function calcHardSkillScore(hardRatings, skillGroups, hardCriteria) {
  if ((!hardRatings || hardRatings.length === 0) && (!hardCriteria || hardCriteria.length === 0)) return 0;

  const normalizedRatings = hardRatings.map((rating) => ({
    ...rating,
    skill: String(rating.skill || '').trim(),
    rating: Math.min(5, Math.max(1, Number(rating.rating) || 1)),
    weight: Number(rating.weight) || 0,
  }));

  const ratingBySkill = new Map(normalizedRatings.map((rating) => [normalizeSkillName(rating.skill), rating]));
  const criteriaItems = uniqueCriteria(hardCriteria);
  const criteriaBySkill = new Map(
    criteriaItems.map((item) => [normalizeSkillName(item.skill), {
      skill: String(item.skill || '').trim(),
      rating: Math.min(5, Math.max(1, Number(ratingBySkill.get(normalizeSkillName(item.skill))?.rating) || 1)),
      weight: Number(item.weight) || 0,
    }])
  );

  const groupedSkills = new Set();
  let earned = 0;
  let totalWeight = 0;

  (Array.isArray(skillGroups) ? skillGroups : []).forEach((group) => {
    const groupSkills = uniqueSkills(group?.skills);
    if (groupSkills.length === 0) return;

    const groupRatings = groupSkills.map((skill) => criteriaBySkill.get(normalizeSkillName(skill))).filter(Boolean);
    const groupWeight = groupRatings.reduce((sum, rating) => sum + rating.weight, 0);
    if (groupWeight === 0) return;

    groupSkills.forEach((skill) => groupedSkills.add(normalizeSkillName(skill)));
    totalWeight += groupWeight;

    const satisfied = group?.rule === 'ANY_ONE'
      ? groupRatings.some((rating) => rating.rating > 1)
      : groupRatings.length === groupSkills.length && groupRatings.every((rating) => rating.rating > 1);

    earned += satisfied ? 5 * groupWeight : 0;
  });

  const remainingRatings = criteriaItems
    .filter((item) => !groupedSkills.has(normalizeSkillName(item.skill)))
    .map((item) => ({
      skill: String(item.skill || '').trim(),
      rating: Math.min(5, Math.max(1, Number(ratingBySkill.get(normalizeSkillName(item.skill))?.rating) || 1)),
      weight: Number(item.weight) || 0,
    }));

  const remainingWeight = remainingRatings.reduce((sum, rating) => sum + rating.weight, 0);
  const remainingEarned = remainingRatings.reduce(
    (sum, rating) => sum + rating.rating * rating.weight,
    0
  );

  totalWeight += remainingWeight;
  earned += remainingEarned;

  if (totalWeight === 0) return 0;
  return Math.round((earned / (5 * totalWeight)) * 100);
}

function normalizeSkillName(value) {
  return String(value || '').trim().toLowerCase();
}

function uniqueSkills(skills) {
  return [...new Set((Array.isArray(skills) ? skills : [])
    .map((skill) => String(skill || '').trim())
    .filter(Boolean))];
}

function uniqueCriteria(criteria) {
  const seen = new Set();
  return (Array.isArray(criteria) ? criteria : []).filter((item) => {
    const key = normalizeSkillName(item?.skill);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
 *
 * Skill-group aware: if a group's rule is ANY_ONE and at least one member
 * skill is present (rating > 1), the whole group is considered satisfied and
 * none of its member skills are reported as gaps/weak — the recruiter only
 * required one of them, so the others are not actually missing requirements.
 * If an ANY_ONE group is NOT satisfied, all of its members are reported
 * together as a single missing-group entry rather than as separate skills.
 * Groups with rule ALL (or no rule) are left untouched — every member is
 * still evaluated individually, since all of them are required.
 *
 * @param {Array} hardRatings - Hard skill ratings [{ skill, rating, weight }]
 * @param {Array} softRatings - Soft skill ratings [{ skill, rating, weight }]
 * @param {Array} skillGroups - Skill groups from the approved JD [{ groupName, skills, rule }]
 */
function identifyGaps(hardRatings, softRatings, skillGroups = []) {
  const hardBySkill = new Map(
    (hardRatings || []).map((r) => [normalizeSkillName(r.skill), r])
  );

  const groupedSkillNames = new Set();
  const groupGaps = [];
  const groupWeak = [];

  (Array.isArray(skillGroups) ? skillGroups : []).forEach((group) => {
    const groupSkills = uniqueSkills(group?.skills);
    if (groupSkills.length === 0) return;

    // Only ANY_ONE groups need special handling; ALL groups behave normally.
    if (group?.rule !== 'ANY_ONE') return;

    groupSkills.forEach((skill) => groupedSkillNames.add(normalizeSkillName(skill)));

    const memberRatings = groupSkills
      .map((skill) => hardBySkill.get(normalizeSkillName(skill)))
      .filter(Boolean);

    const satisfied = memberRatings.some((r) => Number(r.rating) > 1);

    if (!satisfied) {
      // None of the alternatives are present — report the group as a whole
      // so it doesn't look like every individual skill was separately required.
      const label = group.groupName
        ? `${group.groupName} (one of: ${groupSkills.join(', ')})`
        : `One of: ${groupSkills.join(', ')}`;
      groupGaps.push(label);
    } else {
      // Satisfied — but flag it as weak if the only evidence found is weak (rating 2).
      const bestRating = Math.max(...memberRatings.map((r) => Number(r.rating) || 1));
      if (bestRating === 2) {
        const satisfiedSkill = memberRatings.find((r) => Number(r.rating) === 2)?.skill;
        groupWeak.push(satisfiedSkill || group.groupName || groupSkills[0]);
      }
    }
  });

  const ungroupedHard = (hardRatings || []).filter(
    (r) => !groupedSkillNames.has(normalizeSkillName(r.skill))
  );
  const allUngroupedRatings = [...ungroupedHard, ...(softRatings || [])];

  const gaps = [
    ...groupGaps,
    ...allUngroupedRatings.filter((r) => r.rating <= 1).map((r) => r.skill),
  ];
  const weak = [
    ...groupWeak,
    ...allUngroupedRatings.filter((r) => r.rating === 2).map((r) => r.skill),
  ];

  return { gaps, weak };
}

module.exports = { calculateScore, runEligibilityChecks, identifyGaps, classify };
