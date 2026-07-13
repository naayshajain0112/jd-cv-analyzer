/**
 * Prompt for extracting structured requirements from a Job Description.
 */
const jdExtractionPrompt = (jdText) => `
You are an expert recruiter and HR analyst. Analyze the following job description and extract structured requirements.

Return ONLY a valid JSON object — no markdown fences, no preamble, no explanation.

JSON schema to follow exactly:
{
  "jobTitle": "string",
  "experience": "string (e.g. '3+ years', '5-7 years')",
  "education": "string (e.g. \"Bachelor's in CS or related field\")",
  "location": "string (city/country or 'Remote' or 'Hybrid')",
  "workingModel": "string (Remote | Hybrid | On-site)",
  "hardSkills": ["array of technical skills, tools, programming languages, frameworks"],
  "skillGroups": [
    {
      "groupName": "string",
      "skills": ["string"],
      "rule": "ANY_ONE | ALL"
    }
  ],
  "softSkills": ["array of interpersonal/behavioral skills"],
  "mandatoryRequirements": ["list of must-have requirements"],
  "rejectConditions": ["list of conditions that would automatically disqualify a candidate"],
  "responsibilities": ["key job responsibilities, max 8"]
}

Extraction rules:
- Always extract distinct hard skills, even when they also belong to a skill group.
- Detect equivalent or alternative skills mentioned together in the JD and place them in skillGroups.
- Infer rule = ANY_ONE when the JD uses OR, /, "either", "one of", or equivalent alternatives.
- Infer rule = ALL when the JD uses AND, "with", "plus", or a combination that clearly requires all skills.
- If no grouping exists, return an empty skillGroups array.
- Every skill in skillGroups must also appear in hardSkills.

Job Description:
"""
${jdText}
"""
`;

/**
 * Prompt for generating assessment criteria with weights.
 */
const assessmentCriteriaPrompt = (extractedJD) => `
You are a senior technical recruiter. Based on the extracted job requirements below, generate assessment criteria with skill weights.

CRITICAL RULES:
- Hard skills weights must sum to EXACTLY 70 (representing 70% of total score)
- Soft skills weights must sum to EXACTLY 30 (representing 30% of total score)
- Each weight is a number between 1 and 70 (hard) or 1 and 30 (soft)
- importance must be one of: "critical", "important", "nice-to-have"
- ratingGuide: short 1-line guide for rating this skill 1–5

Return ONLY valid JSON, no markdown, no preamble.

JSON schema:
{
  "hardSkills": [
    {
      "skill": "string",
      "weight": number,
      "importance": "critical|important|nice-to-have",
      "ratingGuide": "string"
    }
  ],
  "softSkills": [
    {
      "skill": "string",
      "weight": number,
      "importance": "critical|important|nice-to-have",
      "ratingGuide": "string"
    }
  ]
}

Extracted JD Requirements:
${JSON.stringify(extractedJD, null, 2)}
`;

module.exports = { jdExtractionPrompt, assessmentCriteriaPrompt };
