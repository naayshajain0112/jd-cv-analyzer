const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Extract plain text from PDF, DOCX, or TXT file.
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} - Extracted plain text
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf8');
  }

  if (ext === '.pdf') {
    return extractPDF(filePath);
  }

  if (ext === '.docx' || ext === '.doc') {
    return extractDOCX(filePath);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

async function extractPDF(filePath) {
  // pdf-parse requires a Buffer
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  logger.info(`PDF extracted: ${data.numpages} pages, ${data.text.length} chars`);
  return data.text.trim();
}

async function extractDOCX(filePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  logger.info(`DOCX extracted: ${result.value.length} chars`);
  return result.value.trim();
}

module.exports = { extractText };
