const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Associated User ID is required'],
      unique: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    collegeId: {
      type: String,
      required: [true, 'College ID / Roll number is required'],
      trim: true
    },
    branch: {
      type: String,
      required: [true, 'Branch is required'],
      trim: true
    },
    course: {
      type: String,
      required: [true, 'Course is required'],
      trim: true
    },
    graduationYear: {
      type: Number,
      required: [true, 'Graduation year is required'],
      min: [2000, 'Graduation year must be 2000 or later'],
      max: [2100, 'Graduation year is invalid']
    },
    cgpa: {
      type: Number,
      required: [true, 'CGPA is required'],
      min: [0, 'CGPA cannot be negative'],
      max: [10, 'CGPA cannot exceed 10.0']
    },
    skills: {
      type: [String],
      default: []
    },
    resumeLink: {
      type: String,
      trim: true,
      match: [/^((https?:\/\/[^\s]+)|(\/uploads\/[^\s]+))?$/, 'Please enter a valid URL or uploaded file path for the resume']
    },
    phone: {
      type: String,
      trim: true
    },
    profileCompletionStatus: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    isPlaced: {
      type: Boolean,
      default: false
    },
    placedDrive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Drive'
    },
    placedCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company'
    },
    placedPackage: {
      type: Number
    },
    isPolicyExempt: {
      type: Boolean,
      default: false
    },
    policyExemptionReason: {
      type: String
    },
    policyExemptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
studentProfileSchema.index({ branch: 1 });
studentProfileSchema.index({ graduationYear: 1 });

const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
module.exports = StudentProfile;
