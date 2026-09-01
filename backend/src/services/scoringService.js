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
 * Skill normalization groups: maps similar skills to a canonical form
 * This prevents duplicate scoring of semantically equivalent skills
 */
const SKILL_GROUPS = {
  // Data Structures & Algorithms
  'data structures': 'Data Structures & Algorithms',
  'algorithms': 'Data Structures & Algorithms',
  'dsa': 'Data Structures & Algorithms',
  'data structure': 'Data Structures & Algorithms',
  'algorithm': 'Data Structures & Algorithms',
  
  // REST APIs
  'rest api': 'REST APIs',
  'rest apis': 'REST APIs',
  'api development': 'REST APIs',
  'api design': 'REST APIs',
  'restful': 'REST APIs',
  'restful api': 'REST APIs',
  'rest': 'REST APIs',
  
  // Version Control
  'git': 'Version Control',
  'github': 'Version Control',
  'gitlab': 'Version Control',
  'version control': 'Version Control',
  'vcs': 'Version Control',
  'bitbucket': 'Version Control',
  
  // SQL/Database
  'sql': 'SQL & Databases',
  'database': 'SQL & Databases',
  'databases': 'SQL & Databases',
  'mysql': 'SQL & Databases',
  'postgresql': 'SQL & Databases',
  'sql databases': 'SQL & Databases',
  'relational database': 'SQL & Databases',
  
  // NoSQL
  'nosql': 'NoSQL',
  'mongodb': 'NoSQL',
  'firebase': 'NoSQL',
  'dynamodb': 'NoSQL',
  'cassandra': 'NoSQL',
  
  // Testing
  'testing': 'Testing & QA',
  'unit testing': 'Testing & QA',
  'integration testing': 'Testing & QA',
  'qa': 'Testing & QA',
  'test': 'Testing & QA',
  'jest': 'Testing & QA',
  'mocha': 'Testing & QA',
  'pytest': 'Testing & QA',
  'jstl': 'Testing & QA',
};

/**
 * Normalize a skill name to its canonical form
 * @param {string} skillName - The skill name to normalize
 * @returns {string} The normalized skill name
 */
function normalizeSkillName(skillName) {
  const normalized = String(skillName || '').trim().toLowerCase();
  return SKILL_GROUPS[normalized] || skillName.trim();
}

/**
 * Merge ratings with duplicate skills (after normalization)
 * Keeps the highest rating and combines evidence/reasoning
 * @param {Array} ratings - Array of { skill, rating, weight, evidence, reasoning }
 * @returns {Array} Deduplicated ratings with merged evidence
 */
function deduplicateRatings(ratings) {
  if (!Array.isArray(ratings) || ratings.length === 0) return [];
  
  const merged = new Map();
  
  ratings.forEach((rating) => {
    const normalized = normalizeSkillName(rating.skill);
    const existing = merged.get(normalized);
    
    if (!existing) {
      merged.set(normalized, {
        skill: normalized,
        rating: Math.min(5, Math.max(1, Number(rating.rating) || 1)),
        weight: Number(rating.weight) || 0,
        evidence: rating.evidence || '',
        reasoning: rating.reasoning || '',
      });
    } else {
      // Keep the highest rating
      if (Number(rating.rating) > existing.rating) {
        existing.rating = Math.min(5, Math.max(1, Number(rating.rating) || 1));
      }
      // Combine evidence and reasoning
      if (rating.evidence && !existing.evidence.includes(rating.evidence)) {
        existing.evidence = existing.evidence 
          ? `${existing.evidence}; ${rating.evidence}` 
          : rating.evidence;
      }
      if (rating.reasoning && !existing.reasoning.includes(rating.reasoning)) {
        existing.reasoning = existing.reasoning 
          ? `${existing.reasoning}; ${rating.reasoning}` 
          : rating.reasoning;
      }
    }
  });
  
  return Array.from(merged.values());
}

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
 * Applies skill normalization to prevent duplicate scoring.
 *
 * @param {Array} hardRatings - Hard skill ratings with weights
 * @param {Array} softRatings - Soft skill ratings with weights
 * @param {object} approvedJD - Approved JD containing skillGroups
 * @returns {{ hardSkillScore, softSkillScore, weightedScore, classification }}
 */
function calculateScore(hardRatings, softRatings, approvedJD = {}, assessmentCriteria = {}) {
  // Deduplicate and normalize skills for scoring
  const normalizedHardRatings = deduplicateRatings(hardRatings);
  const normalizedSoftRatings = deduplicateRatings(softRatings);
  
  const softTotalWeight = normalizedSoftRatings.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 30;

  const hardScore = calcHardSkillScore(
    normalizedHardRatings,
    approvedJD.skillGroups || [],
    assessmentCriteria.hardSkills || []
  );
  const softScore = calcCategoryScore(normalizedSoftRatings, softTotalWeight);

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

function uniqueSkills(skills) {
  return [...new Set((Array.isArray(skills) ? skills : [])
    .map((skill) => String(skill || '').trim())
    .filter(Boolean))];
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

module.exports = { calculateScore, runEligibilityChecks, identifyGaps, classify, deduplicateRatings, normalizeSkillName };

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
 */
function identifyGaps(hardRatings, softRatings) {
  const allRatings = [...hardRatings, ...softRatings];
  const gaps = allRatings.filter((r) => r.rating <= 1).map((r) => r.skill);
  const weak = allRatings.filter((r) => r.rating === 2).map((r) => r.skill);
  return { gaps, weak };
}
