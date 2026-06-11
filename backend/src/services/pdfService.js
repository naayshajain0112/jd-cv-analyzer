const PDFDocument = require('pdfkit');

/**
 * Generate a professional client-ready PDF assessment report.
 * Returns a Buffer.
 */
async function generateReportPDF(assessment, jd) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const colors = {
      primary: '#6366f1',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
      dark: '#0f172a',
      gray: '#64748b',
      lightGray: '#f1f5f9',
      white: '#ffffff',
    };

    const scoring = assessment.scoring || {};
    const eligibility = assessment.eligibility || {};

    function verdictColor(verdict) {
      if (verdict === 'Strong Fit') return colors.success;
      if (verdict === 'Moderate Fit') return colors.warning;
      if (verdict === 'Weak Fit') return colors.warning;
      return colors.danger;
    }

    // ── Cover / Header ───────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 120).fill(colors.dark);
    doc.fillColor(colors.white).fontSize(22).font('Helvetica-Bold')
      .text('CV Assessment Report', 50, 35);
    doc.fontSize(11).font('Helvetica')
      .text(`${jd.extracted?.jobTitle || 'Position'} — ${assessment.candidateName || 'Candidate'}`, 50, 65);
    doc.fontSize(9).fillColor('#94a3b8')
      .text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 50, 88);

    doc.moveDown(4);

    // ── Executive Summary ────────────────────────────────────────────────────
    sectionHeader(doc, '1. Executive Summary', colors);

    const verdClr = verdictColor(scoring.classification);
    infoBox(doc, [
      ['Candidate', assessment.candidateName || 'Unknown'],
      ['Position', jd.extracted?.jobTitle || 'Not specified'],
      ['Overall Score', `${scoring.weightedScore ?? 'N/A'} / 100`],
      ['Verdict', scoring.classification || 'N/A'],
      ['Eligibility', eligibility.overallEligible ? 'Eligible ✓' : 'Not Eligible ✗'],
    ], colors, verdClr);

    // Score bars
    scoreBar(doc, 'Hard Skills Score', scoring.hardSkillScore || 0, colors);
    scoreBar(doc, 'Soft Skills Score', scoring.softSkillScore || 0, colors);
    scoreBar(doc, 'Overall Weighted Score', scoring.weightedScore || 0, colors, verdClr);

    // ── Eligibility Checks ───────────────────────────────────────────────────
    doc.addPage();
    sectionHeader(doc, '2. Eligibility Checks', colors);

    const eligChecks = [
      ['Experience', eligibility.experienceMet],
      ['Education', eligibility.educationMet],
      ['Location', eligibility.locationMet],
      ['Mandatory Requirements', eligibility.mandatoryMet],
      ['No Reject Flags', eligibility.noRejectFlags],
    ];

    eligChecks.forEach(([label, met]) => {
      const icon = met ? '✓' : '✗';
      const clr = met ? colors.success : colors.danger;
      doc.fillColor(clr).font('Helvetica-Bold').fontSize(10).text(`${icon} ${label}`, 60, doc.y, { continued: false });
      doc.moveDown(0.3);
    });

    if (eligibility.failureReasons?.length > 0) {
      doc.moveDown(0.5);
      doc.fillColor(colors.danger).font('Helvetica-Bold').fontSize(10).text('Rejection Reasons:');
      eligibility.failureReasons.forEach((reason) => {
        doc.fillColor(colors.dark).font('Helvetica').fontSize(9)
          .text(`• ${reason}`, { indent: 10 });
        doc.moveDown(0.2);
      });
    }

    // ── Hard Skills Assessment ───────────────────────────────────────────────
    doc.addPage();
    sectionHeader(doc, '3. Hard Skills Assessment', colors);
    skillsTable(doc, assessment.hardSkillRatings || [], colors);

    // ── Soft Skills Assessment ───────────────────────────────────────────────
    sectionHeader(doc, '4. Soft Skills Assessment', colors);
    skillsTable(doc, assessment.softSkillRatings || [], colors);

    // ── Gaps & Recommendations ───────────────────────────────────────────────
    doc.addPage();
    sectionHeader(doc, '5. Skill Gaps', colors);

    const allRatings = [...(assessment.hardSkillRatings || []), ...(assessment.softSkillRatings || [])];
    const gaps = allRatings.filter((r) => r.rating <= 1);
    const weak = allRatings.filter((r) => r.rating === 2);

    if (gaps.length === 0 && weak.length === 0) {
      doc.fillColor(colors.gray).font('Helvetica').fontSize(10).text('No significant skill gaps identified.');
    } else {
      if (gaps.length > 0) {
        doc.fillColor(colors.danger).font('Helvetica-Bold').fontSize(10).text('Missing Skills (Rating: 1)');
        gaps.forEach((r) => {
          doc.fillColor(colors.dark).font('Helvetica').fontSize(9).text(`• ${r.skill}: ${r.reasoning || ''}`, { indent: 10 });
          doc.moveDown(0.2);
        });
        doc.moveDown(0.5);
      }
      if (weak.length > 0) {
        doc.fillColor(colors.warning).font('Helvetica-Bold').fontSize(10).text('Weak Skills (Rating: 2)');
        weak.forEach((r) => {
          doc.fillColor(colors.dark).font('Helvetica').fontSize(9).text(`• ${r.skill}: ${r.reasoning || ''}`, { indent: 10 });
          doc.moveDown(0.2);
        });
      }
    }

    // ── Interview Questions ───────────────────────────────────────────────────
    if (assessment.interviewQuestions?.length > 0) {
      doc.addPage();
      sectionHeader(doc, '6. Suggested Interview Questions', colors);

      assessment.interviewQuestions.forEach((q, i) => {
        doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10)
          .text(`Q${i + 1}. [${q.focus || 'General'}]`);
        doc.fillColor(colors.dark).font('Helvetica').fontSize(10)
          .text(q.question, { indent: 10 });
        doc.moveDown(0.3);
        doc.fillColor(colors.gray).font('Helvetica-Oblique').fontSize(9)
          .text(`Expected: ${q.expectedAnswer}`, { indent: 10 });
        doc.moveDown(0.8);
      });
    }

    // ── Final Recommendation ─────────────────────────────────────────────────
    doc.addPage();
    sectionHeader(doc, '7. Final Recommendation', colors);

    const override = assessment.recruiterOverride;
    const finalVerdict = override?.overrideVerdict || scoring.classification || 'N/A';
    const finalScore = override?.overrideScore ?? scoring.weightedScore ?? 0;

    doc.rect(50, doc.y, doc.page.width - 100, 70)
      .fill(verdictColor(finalVerdict) + '22');

    const boxY = doc.y - 60;
    doc.fillColor(verdictColor(finalVerdict)).font('Helvetica-Bold').fontSize(16)
      .text(finalVerdict, 60, boxY + 15);
    doc.fillColor(colors.dark).font('Helvetica').fontSize(10)
      .text(`Final Score: ${finalScore}/100`, 60, boxY + 40);

    if (override?.notes) {
      doc.moveDown(2);
      doc.fillColor(colors.gray).font('Helvetica-Bold').fontSize(10).text('Recruiter Notes:');
      doc.fillColor(colors.dark).font('Helvetica').fontSize(10).text(override.notes);
    }

    // ── Footer on all pages ───────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor(colors.gray).font('Helvetica').fontSize(8)
        .text(
          `CVMatch Assessment Platform  •  Page ${i + 1} of ${range.count}  •  Confidential`,
          50, doc.page.height - 40,
          { align: 'center', width: doc.page.width - 100 }
        );
    }

    doc.end();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sectionHeader(doc, title, colors) {
  doc.moveDown(0.5);
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(13).text(title);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y)
    .strokeColor(colors.primary).lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function infoBox(doc, rows, colors) {
  rows.forEach(([label, value]) => {
    doc.fillColor(colors.gray).font('Helvetica-Bold').fontSize(9)
      .text(`${label}: `, { continued: true });
    doc.fillColor(colors.dark).font('Helvetica').fontSize(9).text(value);
    doc.moveDown(0.3);
  });
  doc.moveDown(0.5);
}

function scoreBar(doc, label, score, colors, barColor) {
  const barClr = barColor || (score >= 70 ? colors.success : score >= 50 ? colors.warning : colors.danger);
  const barWidth = Math.max(0, Math.min(score / 100, 1)) * (doc.page.width - 160);

  doc.fillColor(colors.dark).font('Helvetica').fontSize(9).text(`${label}: ${score}%`);
  doc.rect(60, doc.y, doc.page.width - 160, 8).fill(colors.lightGray);
  doc.rect(60, doc.y - 8, barWidth, 8).fill(barClr);
  doc.moveDown(0.8);
}

function skillsTable(doc, ratings, colors) {
  if (!ratings || ratings.length === 0) {
    doc.fillColor(colors.gray).fontSize(9).text('No ratings available.');
    doc.moveDown(0.5);
    return;
  }

  // Header
  doc.fillColor(colors.white).rect(50, doc.y, doc.page.width - 100, 18).fill(colors.primary);
  const headerY = doc.y - 14;
  doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(8)
    .text('Skill', 55, headerY, { width: 120 });
  doc.text('Rating', 180, headerY, { width: 50 });
  doc.text('Weight', 230, headerY, { width: 50 });
  doc.text('Evidence / Reasoning', 285, headerY, { width: 260 });
  doc.moveDown(0.2);

  ratings.forEach((r, idx) => {
    const rowY = doc.y;
    if (idx % 2 === 0) {
      doc.rect(50, rowY, doc.page.width - 100, 30).fill(colors.lightGray);
    }

    const ratingColor =
      r.rating >= 4 ? colors.success
      : r.rating === 3 ? colors.warning
      : colors.danger;

    doc.fillColor(colors.dark).font('Helvetica').fontSize(8)
      .text(r.skill, 55, rowY + 4, { width: 120 });
    doc.fillColor(ratingColor).font('Helvetica-Bold').fontSize(8)
      .text(`${r.rating}/5`, 180, rowY + 4, { width: 45 });
    doc.fillColor(colors.dark).font('Helvetica').fontSize(8)
      .text(`${r.weight}`, 230, rowY + 4, { width: 45 });
    doc.font('Helvetica').fontSize(7)
      .text(
        (r.evidence || r.reasoning || '').substring(0, 120),
        285, rowY + 4, { width: 260, height: 25, ellipsis: true }
      );

    doc.y = rowY + 32;

    // Page overflow guard
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
    }
  });

  doc.moveDown(1);
}

module.exports = { generateReportPDF };
