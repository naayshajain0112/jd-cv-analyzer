/**
 * Prompt for assessing a CV against JD criteria.
 * IMPORTANT: Gemini only rates 1–5. Scoring is done in backend code.
 */
const cvAssessmentPrompt = (approvedJD, criteria, cvText) => `
You are an expert technical recruiter. Assess the candidate's CV against the job requirements.

STRICT RULES:
1. Rate each skill 1–5 ONLY based on evidence found in the CV text provided.
2. Evidence must be a DIRECT QUOTE or specific reference from the CV.
3. If a skill is not mentioned at all, rate it 1 and state "Not mentioned in CV".
4. Do NOT invent evidence. Do NOT assume skills the candidate has not demonstrated.
5. Return ONLY valid JSON — no markdown fences, no explanation.

Rating scale:
1 = Not present / Not mentioned
2 = Mentioned briefly / Minimal evidence  
3 = Moderate evidence / Some experience
4 = Strong evidence / Clear proficiency
5 = Expert level / Extensive proven experience

JSON schema:
{
  "candidateName": "string (extract from CV, or 'Unknown')",
  "hardSkillRatings": [
    {
      "skill": "string",
      "rating": number (1-5),
      "evidence": "exact quote or reference from CV",
      "reasoning": "1-2 sentence explanation of rating"
    }
  ],
  "softSkillRatings": [
    {
      "skill": "string",
      "rating": number (1-5),
      "evidence": "exact quote or reference from CV",
      "reasoning": "1-2 sentence explanation of rating"
    }
  ],
  "eligibilityChecks": {
    "experienceYears": "string (years found in CV, e.g. '4 years')",
    "experienceMet": boolean,
    "educationFound": "string (degree found in CV)",
    "educationMet": boolean,
    "locationFound": "string (location in CV)",
    "locationMet": boolean,
    "mandatoryCheckResults": [
      { "requirement": "string", "met": boolean, "evidence": "string" }
    ],
    "rejectFlagResults": [
      { "condition": "string", "flagged": boolean, "evidence": "string" }
    ]
  }
}

Job Requirements:
${JSON.stringify(approvedJD, null, 2)}

Assessment Criteria (use these exact skill names):
${JSON.stringify(criteria, null, 2)}

Candidate CV:
"""
${cvText}
"""
`;

/**
 * Prompt for generating targeted interview questions.
 */
const interviewQuestionsPrompt = (approvedJD, skillGaps, weakSkills) => `
You are a senior technical interviewer. Generate targeted interview questions for a candidate.

Rules:
- Generate MAXIMUM 7 questions
- Focus on: missing skills, weak skills (rated 1-2), and critical skills
- Each question must have a concise expected answer
- Questions should be specific and practical, not generic
- Return ONLY valid JSON — no markdown, no preamble

JSON schema:
{
  "questions": [
    {
      "question": "string",
      "expectedAnswer": "string (2-4 sentences)",
      "focus": "string (e.g. 'Missing Skill: Docker' or 'Weak Skill: TypeScript')"
    }
  ]
}

Job Title: ${approvedJD.jobTitle || 'Not specified'}
Skill Gaps (missing): ${JSON.stringify(skillGaps)}
Weak Skills (rated 1-2): ${JSON.stringify(weakSkills)}
Critical Skills: ${JSON.stringify(
  [...(approvedJD.hardSkills || [])].slice(0, 5)
)}
`;

module.exports = { cvAssessmentPrompt, interviewQuestionsPrompt };
