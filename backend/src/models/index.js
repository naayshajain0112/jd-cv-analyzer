const mongoose = require('mongoose');

// ── Job Description Model ────────────────────────────────────────────────────
const JDSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  rawText: {
    type: String,
    required: true,
  },
  extracted: {
    jobTitle:            String,
    experience: {
      minimum: Number,
      allowHigherExperience: { type: Boolean, default: true },
    },
    education:           String,
    location:            String,
    workingModel:        String,
    hardSkills:          [String],
    skillGroups: [{
      id:        String,
      groupName: String,
      skills:    [String],
      rule:      { type: String, enum: ['ALL', 'ANY_ONE'], default: 'ALL' },
    }],
    softSkills:          [String],
    mandatoryRequirements: [String],
    rejectConditions:    [String],
    responsibilities:    [String],
  },
  assessmentCriteria: {
    hardSkills: [{
      skill:       String,
      weight:      Number,
      importance:  { type: String, enum: ['critical', 'important', 'nice-to-have'] },
      ratingGuide: String,
    }],
    softSkills: [{
      skill:       String,
      weight:      Number,
      importance:  { type: String, enum: ['critical', 'important', 'nice-to-have'] },
      ratingGuide: String,
    }],
  },
  approved: { type: Boolean, default: false },
}, { timestamps: true });

// ── Assessment Model ─────────────────────────────────────────────────────────
const AssessmentSchema = new mongoose.Schema({
  jdId:           { type: mongoose.Schema.Types.ObjectId, ref: 'JD', required: true },
  candidateName:  String,
  resumeName:     String,
  linkedinName:   String,
  resumeFileName: String,
  resumeText:     String,
  hardSkillRatings: [{
    skill:     String,
    rating:    Number,  // 1-5
    weight:    Number,
    evidence:  String,
    reasoning: String,
  }],
  softSkillRatings: [{
    skill:     String,
    rating:    Number,
    weight:    Number,
    evidence:  String,
    reasoning: String,
  }],
  eligibility: {
    experienceMet:   Boolean,
    educationMet:    Boolean,
    locationMet:     Boolean,
    mandatoryMet:    Boolean,
    noRejectFlags:   Boolean,
    failureReasons:  [String],
    overallEligible: Boolean,
  },
  scoring: {
    hardSkillScore:  Number,
    softSkillScore:  Number,
    weightedScore:   Number,
    classification:  { type: String, enum: ['Strong Fit', 'Moderate Fit', 'Weak Fit', 'Reject'] },
  },
  // Skill-group aware gaps/weak-skills, computed once at assessment time so
  // the report doesn't need to (incorrectly) recompute this without knowing
  // about ANY_ONE skill groups.
  skillGapAnalysis: {
    gaps: [String],
    weak: [String],
  },
  interviewQuestions: [{
    question:       String,
    expectedAnswer: String,
    focus:          String,
  }],
  recruiterOverride: {
    overrideScore:  Number,
    notes:          String,
    overrideVerdict: String,
  },
}, { timestamps: true });

const JD = mongoose.model('JD', JDSchema);
const Assessment = mongoose.model('Assessment', AssessmentSchema);

module.exports = { JD, Assessment };
