const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');

const PAGE = {
  margin: 46,
  top: 46,
  bottom: 58,
};

const colors = {
  navy: '#172033',
  text: '#202938',
  muted: '#667085',
  border: '#D0D5DD',
  softBorder: '#EAECF0',
  surface: '#F8FAFC',
  white: '#FFFFFF',
  primary: '#3056D3',
  success: '#16803C',
  warning: '#B54708',
  danger: '#B42318',
};

/**
 * Generate a professional ATS-style PDF assessment report.
 * Returns a Buffer.
 */
async function generateReportPDF(assessment, jd) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE.margin,
      size: 'A4',
      bufferPages: false,
      autoFirstPage: true,
      info: {
        Title: `CV Assessment Report - ${resolveCandidateName(assessment)}`,
        Author: 'CVMatch Assessment Platform',
      },
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const scoring = assessment.scoring || {};
    const eligibility = assessment.eligibility || {};
    const override = assessment.recruiterOverride || {};
    const candidateName = resolveCandidateName(assessment);
    const jobTitle = cleanText(jd?.extracted?.jobTitle) || cleanText(jd?.title) || 'Target Role';
    const finalScore = numeric(override.overrideScore ?? scoring.weightedScore, 0);
    const finalVerdict = cleanText(override.overrideVerdict || scoring.classification) || 'N/A';
    const finalColor = verdictColor(finalVerdict);
    const generatedOn = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    drawHeader(doc, candidateName, jobTitle, generatedOn, finalColor);
    doc.x = PAGE.margin;
    doc.y = 140;

    sectionHeader(doc, 'Candidate Summary');
    keyValueGrid(doc, [
      ['Candidate', candidateName],
      ['Role', jobTitle],
      ['Resume File', cleanText(assessment.resumeFileName) || 'Not available'],
      ['Overall Score', `${finalScore}/100`],
      ['Verdict', finalVerdict],
      ['Eligibility', eligibility.overallEligible ? 'Eligible' : 'Not Eligible'],
    ]);

    sectionHeader(doc, 'Score Overview');
    scoreBar(doc, 'Hard Skills', numeric(scoring.hardSkillScore, 0));
    scoreBar(doc, 'Soft Skills', numeric(scoring.softSkillScore, 0));
    scoreBar(doc, 'Weighted Overall', finalScore, finalColor);

    sectionHeader(doc, 'Role Comparison');
    roleComparisonTable(doc, assessment, jd);

    sectionHeader(doc, 'Eligibility Checks');
    eligibilityTable(doc, eligibility);

    sectionHeader(doc, 'Hard Skills Assessment');
    skillsTable(doc, assessment.hardSkillRatings || []);

    sectionHeader(doc, 'Soft Skills Assessment');
    skillsTable(doc, assessment.softSkillRatings || []);

    sectionHeader(doc, 'Skill Gaps');
    gapsSection(doc, assessment);
    rejectionReasonsSection(doc, eligibility);

    if (assessment.interviewQuestions?.length > 0) {
      sectionHeader(doc, 'Suggested Interview Questions');
      interviewQuestions(doc, assessment.interviewQuestions);
    }

    sectionHeader(doc, 'Final Recommendation');
    recommendationBox(doc, finalVerdict, finalScore, finalColor, override.notes);

    //addFooters(doc);
    doc.end();
  });
}

/**
 * Generate a summary PDF covering every candidate in a single assessment run.
 * `assessments` should already be scoped to the candidates the recruiter
 * wants summarized (e.g. one JD + one batch of resumes) — this function
 * does not do any additional filtering.
 * Returns a Buffer.
 */
async function generateSummaryPDF(assessments = [], jd) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE.margin,
      size: 'A4',
      bufferPages: false,
      autoFirstPage: true,
      info: {
        Title: `Candidate Summary Report - ${cleanText(jd?.extracted?.jobTitle || jd?.title) || 'Assessment'}`,
        Author: 'CVMatch Assessment Platform',
      },
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const jobTitle = cleanText(jd?.extracted?.jobTitle) || cleanText(jd?.title) || 'Target Role';
    const generatedOn = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const scored = assessments.map((a) => {
      const scoring = a.scoring || {};
      const override = a.recruiterOverride || {};
      const finalScore = numeric(override.overrideScore ?? scoring.weightedScore, 0);
      const finalVerdict = cleanText(override.overrideVerdict || scoring.classification) || 'N/A';
      return { assessment: a, scoring, finalScore, finalVerdict };
    }).sort((a, b) => b.finalScore - a.finalScore);

    const totalCandidates = scored.length;
    const strongCount = scored.filter((s) => s.finalScore >= 85).length;
    const eligibleCount = scored.filter((s) => s.assessment.eligibility?.overallEligible).length;
    const avgScore = totalCandidates
      ? Math.round(scored.reduce((sum, s) => sum + s.finalScore, 0) / totalCandidates)
      : 0;

    drawHeader(doc, 'Candidates Summary', jobTitle, generatedOn, colors.primary);
    doc.x = PAGE.margin;
    doc.y = 140;

    sectionHeader(doc, 'Assessment Overview');
    keyValueGrid(doc, [
      ['Role', jobTitle],
      ['Total Candidates', String(totalCandidates)],
      ['Strong Fits (≥85)', String(strongCount)],
      ['Average Score', `${avgScore}/100`],
      ['Eligible Candidates', String(eligibleCount)],
      ['Generated On', generatedOn],
    ]);

    sectionHeader(doc, 'Candidates Ranked by Score');
    const rows = scored.map((s, i) => [
      String(i + 1),
      resolveCandidateName(s.assessment),
      `${s.finalScore}/100`,
      s.finalVerdict,
      s.assessment.eligibility?.overallEligible ? 'Eligible' : 'Not Eligible',
      `${numeric(s.scoring.hardSkillScore, 0)}%`,
      `${numeric(s.scoring.softSkillScore, 0)}%`,
    ]);
    table(
      doc,
      ['#', 'Candidate', 'Score', 'Verdict', 'Eligibility', 'Hard', 'Soft'],
      rows,
      [0.06, 0.28, 0.12, 0.18, 0.16, 0.10, 0.10],
      { colorizeStatusColumn: -1 }
    );

    doc.end();
  });
}

function resolveCandidateName(assessment = {}) {
  const resumeName = firstMeaningful(
    assessment.candidateName,
    extractResumeNameFromFileName(assessment.resumeFileName),
    assessment.resumeName,
    assessment.extractedResumeName,
    extractResumeNameFromText(assessment.resumeText)
  );
  const linkedInName = firstMeaningful(
    assessment.linkedinName,
    assessment.linkedInName,
    extractLinkedInNameFromText(assessment.resumeText)
  );
  return firstMeaningful(resumeName, linkedInName) || 'Candidate';
}

function extractResumeNameFromFileName(fileName = '') {
  let base = cleanText(fileName);
  if (!base) return '';

  base = base.replace(/\.[^.]+$/i, '');

  if (/\s*[-_ ]*resume\s*$/i.test(base)) {
    base = base.replace(/\s*[-_ ]*resume\s*$/i, '');
  } else if (base.includes('-')) {
    base = base.split('-').slice(0, -1).join('-') || base;
  }

  base = base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base || /^(resume|cv|curriculum vitae)$/i.test(base)) return '';
  return titleCase(base);
}

function firstMeaningful(...values) {
  return values
    .map(cleanText)
    .find((value) => value && !/^unknown$/i.test(value) && !/^candidate$/i.test(value) && !/^n\/a$/i.test(value) && value !== '-');
}

function extractResumeNameFromText(text = '') {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .slice(0, 12);

  return lines.find((line) => {
    if (line.length < 3 || line.length > 70) return false;
    if (/@|https?:|linkedin|github|portfolio|resume|curriculum vitae|phone|email/i.test(line)) return false;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) return false;
    return words.every((word) => /^[A-Za-z][A-Za-z'.-]*$/.test(word));
  });
}

function extractLinkedInNameFromText(text = '') {
  const match = String(text).match(/linkedin\.com\/in\/([A-Za-z0-9-_%]+)/i);
  if (!match) return '';
  return match[1]
    .replace(/[-_%]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function drawHeader(doc, candidateName, jobTitle, generatedOn, accentColor) {
  const startY = 0;
  doc.rect(0, startY, doc.page.width, 112).fill(colors.navy);
  doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(20)
    .text('CV Assessment Report', PAGE.margin, 30, { width: contentWidth(doc) - 150 });
  doc.fillColor('#CBD5E1').font('Helvetica').fontSize(9)
    .text(`Generated: ${generatedOn}`, PAGE.margin, 58);

  drawLogo(doc);

  doc.x = PAGE.margin;
  doc.y = 140;
}

function drawLogo(doc) {
  if (!fs.existsSync(LOGO_PATH)) return;

  const badgeWidth = 140;
  const badgeHeight = 50;
  const badgeX = doc.page.width - PAGE.margin - badgeWidth;
  const badgeY = 31;
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 6).fill(colors.white);

  const padding = 8;
  const maxWidth = badgeWidth - padding * 2;
  const maxHeight = badgeHeight - padding * 2;

  doc.image(LOGO_PATH, badgeX + padding, badgeY + padding, {
    fit: [maxWidth, maxHeight],
    align: 'center',
    valign: 'center',
  });
}

function sectionHeader(doc, title) {
  ensureSpace(doc, 80);
  doc.x = PAGE.margin;
  ensureSpace(doc, 38);
  doc.x = PAGE.margin;
  
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(12)
    .text(title, PAGE.margin, doc.y, { width: contentWidth(doc) });
  const y = doc.y + 5;
  doc.moveTo(PAGE.margin, y).lineTo(doc.page.width - PAGE.margin, y)
    .strokeColor(colors.border).lineWidth(0.7).stroke();
  doc.y = y + 12;
}

function keyValueGrid(doc, rows) {
  doc.x = PAGE.margin;
  const gap = 12;
  const colWidth = (contentWidth(doc) - gap) / 2;
  const rowHeight = 38;
  const rowGap = 8;
  const totalRows = Math.ceil(rows.length / 2);

  ensureSpace(doc, totalRows * (rowHeight + rowGap));
  doc.x = PAGE.margin;

  const startY = doc.y;

  rows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE.margin + col * (colWidth + gap);
    const y = startY + row * (rowHeight + rowGap);

    doc.roundedRect(x, y, colWidth, rowHeight, 4)
      .fillAndStroke(colors.surface, colors.softBorder);
    doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(7)
      .text(String(label).toUpperCase(), x + 10, y + 8, { width: colWidth - 20 });
    doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(9)
      .text(cleanText(value) || 'N/A', x + 10, y + 20, { width: colWidth - 20, ellipsis: true });
  });

  doc.y = startY + totalRows * (rowHeight + rowGap) + 4;
}

function scoreBar(doc, label, score, barColor) {
  doc.x = PAGE.margin;
  const value = clamp(score, 0, 100);
  const trackX = PAGE.margin + 138;
  const trackWidth = contentWidth(doc) - 188;
  const y = doc.y + 2;
  ensureSpace(doc, 26);
  doc.x = PAGE.margin;

  doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(9)
    .text(label, PAGE.margin, y, { width: 128 });
  doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(9)
    .text(`${value}%`, trackX + trackWidth + 8, y, { width: 42, align: 'right' });
  doc.roundedRect(trackX, y + 3, trackWidth, 8, 4).fill(colors.softBorder);
  doc.roundedRect(trackX, y + 3, (trackWidth * value) / 100, 8, 4)
    .fill(barColor || scoreColor(value));
  doc.y = y + 24;
}

function roleComparisonTable(doc, assessment, jd) {
  const eligibility = assessment.eligibility || {};
  const extracted = jd?.extracted || {};
  const rows = [
    ['Experience', formatExperienceRequirement(extracted.experience), statusLabel(eligibility.experienceMet)],
    ['Education', cleanText(extracted.education) || 'Not specified', statusLabel(eligibility.educationMet)],
    ['Location', cleanText(extracted.location) || 'Not specified', statusLabel(eligibility.locationMet)],
  ];

  table(doc, ['Area', 'Job Requirement', 'Status'], rows, [0.28, 0.52, 0.20]);
}

function formatExperienceRequirement(experience) {
  if (!experience) return 'Not specified';
  if (typeof experience === 'string') return cleanText(experience) || 'Not specified';

  const minimum = Number(experience.minimum);
  if (Number.isFinite(minimum)) return `${minimum}+ years`;

  return 'Not specified';
}

function eligibilityTable(doc, eligibility = {}) {
  const details = eligibility.details || {};
  const rows = [
    ['Experience', statusLabel(eligibility.experienceMet), cleanText(details.experienceYears) || 'No extracted evidence'],
    ['Education', statusLabel(eligibility.educationMet), cleanText(details.educationFound) || 'No extracted evidence'],
    ['Location', statusLabel(eligibility.locationMet), cleanText(details.locationFound) || 'No extracted evidence'],
    ['Mandatory Requirements', statusLabel(eligibility.mandatoryMet), requirementsEvidence(details.mandatoryCheckResults)],
    ['Reject Flags', statusLabel(eligibility.noRejectFlags), rejectEvidence(details.rejectFlagResults)],
  ];

  table(doc, ['Check', 'Result', 'Evidence'], rows, [0.28, 0.18, 0.54]);
}

function rejectionReasonsSection(doc, eligibility = {}) {
  if (!eligibility.failureReasons?.length) return;
  ensureSpace(doc, 36);
  doc.fillColor(colors.danger).font('Helvetica-Bold').fontSize(9).text('Rejection Reasons');
  bulletList(doc, eligibility.failureReasons);
}

function skillsTable(doc, ratings) {
  if (!ratings?.length) {
    paragraph(doc, 'No ratings available.', colors.muted);
    return;
  }

  const rows = ratings.map((rating) => [
    cleanText(rating.skill) || 'Skill',
    `${numeric(rating.rating, 0)}/5`,
    String(numeric(rating.weight, 0)),
    cleanText(rating.evidence || rating.reasoning) || 'No evidence provided',
  ]);

  table(doc, ['Skill', 'Rating', 'Weight', 'Evidence / Reasoning'], rows, [0.25, 0.12, 0.12, 0.51], {
    colorizeStatusColumn: 1,
  });
}

function gapsSection(doc, assessment) {
  const allRatings = [...(assessment.hardSkillRatings || []), ...(assessment.softSkillRatings || [])];
  const ratingBySkill = new Map(allRatings.map((r) => [String(r.skill || '').trim().toLowerCase(), r]));

  // Prefer the backend's skill-group-aware gap analysis (respects ANY_ONE
  // groups) if it was computed for this assessment; otherwise fall back to a
  // naive per-skill check for older assessments that predate this field.
  const storedGaps = assessment.skillGapAnalysis?.gaps;
  const storedWeak = assessment.skillGapAnalysis?.weak;

  const missingLabels = Array.isArray(storedGaps)
    ? storedGaps
    : allRatings.filter((rating) => numeric(rating.rating, 0) <= 1).map((rating) => rating.skill);
  const weakLabels = Array.isArray(storedWeak)
    ? storedWeak
    : allRatings.filter((rating) => numeric(rating.rating, 0) === 2).map((rating) => rating.skill);

  if (!missingLabels.length && !weakLabels.length) {
    paragraph(doc, 'No significant skill gaps identified.', colors.muted);
    return;
  }

  // Group entries (e.g. "Frontend Framework (one of: React, Vue, Angular)")
  // won't have a matching rating record — fall back to a generic reason.
  const describe = (label) => {
    const rating = ratingBySkill.get(String(label || '').trim().toLowerCase());
    return `${label}: ${rating?.reasoning || rating?.evidence || 'Not mentioned in CV'}`;
  };
  const describeWeak = (label) => {
    const rating = ratingBySkill.get(String(label || '').trim().toLowerCase());
    return `${label}: ${rating?.reasoning || rating?.evidence || 'Limited evidence found'}`;
  };

  if (missingLabels.length) {
    doc.fillColor(colors.danger).font('Helvetica-Bold').fontSize(9).text('Missing Skills');
    bulletList(doc, missingLabels.map(describe));
  }

  if (weakLabels.length) {
    doc.fillColor(colors.warning).font('Helvetica-Bold').fontSize(9).text('Weak Skills');
    bulletList(doc, weakLabels.map(describeWeak));
  }
}

function interviewQuestions(doc, questions) {
  questions.forEach((question, index) => {
    const focus = cleanText(question.focus) || 'General';
    const q = cleanText(question.question) || 'Question not provided';
    const expected = cleanText(question.expectedAnswer) || 'Expected answer not provided';
    const block = `Q${index + 1}. [${focus}] ${q}\nExpected: ${expected}`;
    const height = doc.heightOfString(block, { width: contentWidth(doc) - 20 }) + 20;
    ensureSpace(doc, height);

    const y = doc.y;
    doc.roundedRect(PAGE.margin, y, contentWidth(doc), height, 4)
      .fillAndStroke(colors.surface, colors.softBorder);
    doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(9)
      .text(`Q${index + 1}. [${focus}]`, PAGE.margin + 10, y + 9, { width: contentWidth(doc) - 20 });
    doc.fillColor(colors.text).font('Helvetica').fontSize(9)
      .text(q, PAGE.margin + 10, doc.y + 2, { width: contentWidth(doc) - 20 });
    doc.fillColor(colors.muted).font('Helvetica-Oblique').fontSize(8)
      .text(`Expected: ${expected}`, PAGE.margin + 10, doc.y + 5, { width: contentWidth(doc) - 20 });
    doc.y = y + height + 8;
  });
}

function recommendationBox(doc, verdict, score, color, notes) {
  const noteText = cleanText(notes);
  const message = noteText || 'No recruiter override notes were added.';
  const height = 76 + doc.heightOfString(message, { width: contentWidth(doc) - 20 });
  ensureSpace(doc, height);

  const y = doc.y;
  doc.roundedRect(PAGE.margin, y, contentWidth(doc), height, 5)
    .fillAndStroke('#F9FAFB', colors.softBorder);
  doc.fillColor(color).font('Helvetica-Bold').fontSize(15)
    .text(verdict, PAGE.margin + 12, y + 12, { width: contentWidth(doc) - 24 });
  doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(10)
    .text(`Final Score: ${score}/100`, PAGE.margin + 12, doc.y + 4);
  doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8)
    .text('Recruiter Notes', PAGE.margin + 12, doc.y + 12);
  doc.fillColor(colors.text).font('Helvetica').fontSize(9)
    .text(message, PAGE.margin + 12, doc.y + 4, { width: contentWidth(doc) - 24 });
  doc.y = y + height + 8;
}

function table(doc, headers, rows, fractions, options = {}) {
  doc.x = PAGE.margin;
  const tableWidth = contentWidth(doc);
  const colWidths = fractions.map((fraction) => Math.floor(tableWidth * fraction));
  colWidths[colWidths.length - 1] += tableWidth - colWidths.reduce((sum, width) => sum + width, 0);
  const rowPadding = 7;
  const headerHeight = 22;

  const drawHeaderRow = () => {
    ensureSpace(doc, headerHeight + 8);
    doc.x = PAGE.margin;
    const y = doc.y;
    doc.rect(PAGE.margin, y, tableWidth, headerHeight).fill(colors.navy);
    let x = PAGE.margin;
    headers.forEach((header, index) => {
      doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(7.5)
        .text(String(header).toUpperCase(), x + rowPadding, y + 7, { width: colWidths[index] - rowPadding * 2 });
      x += colWidths[index];
    });
    doc.y = y + headerHeight;
  };

  drawHeaderRow();

  rows.forEach((row, rowIndex) => {
    const cellHeights = row.map((cell, index) => {
      doc.font('Helvetica').fontSize(8);
      return doc.heightOfString(cleanText(cell) || 'N/A', { width: colWidths[index] - rowPadding * 2 });
    });
    const rowHeight = Math.max(28, Math.max(...cellHeights) + rowPadding * 2);

    if (doc.y + rowHeight > pageBottom(doc)) {
      doc.addPage();
      doc.x = PAGE.margin;
      drawHeaderRow();
    }

    doc.x = PAGE.margin;
    const y = doc.y;
    doc.rect(PAGE.margin, y, tableWidth, rowHeight)
      .fill(rowIndex % 2 === 0 ? colors.white : colors.surface);
    doc.rect(PAGE.margin, y, tableWidth, rowHeight)
      .strokeColor(colors.softBorder).lineWidth(0.5).stroke();

    let x = PAGE.margin;
    row.forEach((cell, index) => {
      const value = cleanText(cell) || 'N/A';
      const color = options.colorizeStatusColumn === index
        ? ratingColor(value)
        : statusColor(value) || colors.text;
      const font = index === 0 ? 'Helvetica-Bold' : 'Helvetica';
      doc.fillColor(color).font(font).fontSize(8)
        .text(value, x + rowPadding, y + rowPadding, {
          width: colWidths[index] - rowPadding * 2,
          height: rowHeight - rowPadding * 2,
          ellipsis: true,
        });
      x += colWidths[index];
    });

    doc.y = y + rowHeight;
  });

  doc.y += 10;
}

function paragraph(doc, text, color = colors.text) {
  doc.x = PAGE.margin;
  const value = cleanText(text);
  if (!value) return;
  const height = doc.heightOfString(value, { width: contentWidth(doc), lineGap: 2 }) + 6;
  ensureSpace(doc, height);
  doc.x = PAGE.margin;
  doc.fillColor(color).font('Helvetica').fontSize(9)
    .text(value, PAGE.margin, doc.y, { width: contentWidth(doc), lineGap: 2 });
  doc.moveDown(0.5);
}

function bulletList(doc, items) {
  doc.x = PAGE.margin;
  items.filter(Boolean).forEach((item) => {
    const value = cleanText(item);
    const height = doc.heightOfString(value, { width: contentWidth(doc) - 16 }) + 8;
    ensureSpace(doc, height);
    doc.x = PAGE.margin;
    const y = doc.y;
    doc.fillColor(colors.text).font('Helvetica').fontSize(8.5)
      .text('-', PAGE.margin + 2, y, { width: 10 });
    doc.text(value, PAGE.margin + 16, y, { width: contentWidth(doc) - 16 });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.3);
}

function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > pageBottom(doc)) {
    console.log('NEW PAGE');

    doc.addPage();

    // Force cursor to top of new page
    doc.x = PAGE.margin;
    doc.y = PAGE.top;
  }
}

function addFooters(doc) {
  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);

    doc.fontSize(8);
    doc.fillColor(colors.muted);

    doc.text(
      `Page ${i + 1} of ${range.count}`,
      PAGE.margin,
      doc.page.height - 40,
      {
        width: contentWidth(doc),
        align: 'center'
      }
    );
  }
}

function contentWidth(doc) {
  return doc.page.width - PAGE.margin * 2;
}

function pageBottom(doc) {
  return doc.page.height - PAGE.bottom;
}

function scoreColor(score) {
  if (score >= 70) return colors.success;
  if (score >= 50) return colors.warning;
  return colors.danger;
}

function verdictColor(verdict) {
  if (/strong/i.test(verdict)) return colors.success;
  if (/moderate|weak/i.test(verdict)) return colors.warning;
  if (/reject/i.test(verdict)) return colors.danger;
  return colors.primary;
}

function ratingColor(value) {
  const rating = Number(String(value).match(/\d+/)?.[0] || 0);
  if (rating >= 4) return colors.success;
  if (rating >= 3) return colors.warning;
  return colors.danger;
}

function statusColor(value) {
  if (/not eligible|not met|flagged|fail/i.test(value)) return colors.danger;
  if (/eligible|met|clear|pass/i.test(value)) return colors.success;
  return null;
}

function boolLabel(value) {
  if (value === true) return 'Evidence found';
  if (value === false) return 'No evidence found';
  return 'Not assessed';
}

function statusLabel(value) {
  if (value === true) return 'Met';
  if (value === false) return 'Not Met';
  return 'Not Assessed';
}

function listText(items) {
  return Array.isArray(items) && items.length ? items.join('; ') : 'Not specified';
}

function requirementsEvidence(items) {
  if (!Array.isArray(items) || !items.length) return 'No extracted requirement evidence';
  return items
    .map((item) => `${item.requirement || 'Requirement'}: ${item.met ? 'met' : 'not met'}${item.evidence ? ` (${item.evidence})` : ''}`)
    .join('; ');
}

function rejectEvidence(items) {
  if (!Array.isArray(items) || !items.length) return 'No reject flags extracted';
  return items
    .map((item) => `${item.condition || 'Condition'}: ${item.flagged ? 'flagged' : 'clear'}${item.evidence ? ` (${item.evidence})` : ''}`)
    .join('; ');
}

function numeric(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, numeric(value, min)));
}

function cleanText(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function titleCase(value) {
  return cleanText(value).toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

module.exports = {
  generateReportPDF,
  generateSummaryPDF,
  resolveCandidateName,
  extractResumeNameFromFileName,
  extractResumeNameFromText,
  extractLinkedInNameFromText,
};
