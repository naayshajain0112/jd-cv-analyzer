const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

let genAI;
let model;

function getModel() {
  if (!model) {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  return model;
}

/**
 * Call Gemini and parse the JSON response.
 * @param {string} prompt
 * @returns {Promise<object>} Parsed JSON object
 */
async function callGemini(prompt) {
  const m = getModel();
  logger.info(`Calling Gemini (prompt length: ${prompt.length} chars)`);

  const result = await m.generateContent(prompt);
  const text = result.response.text();

  logger.info(`Gemini response received (${text.length} chars)`);

  // Strip markdown fences if present
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    logger.error('Failed to parse Gemini JSON response:', cleaned.substring(0, 500));
    throw new Error('Gemini returned invalid JSON. Please try again.');
  }
}

module.exports = { callGemini };
