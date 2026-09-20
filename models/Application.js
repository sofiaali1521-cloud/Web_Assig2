const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student User reference is required']
    },
    drive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Drive',
      required: [true, 'Drive reference is required']
    },
    status: {
      type: String,
      enum: {
        values: ['applied', 'shortlisted', 'interviewed', 'selected', 'rejected', 'withdrawn'],
        message: '{VALUE} is not a valid application status'
      },
      default: 'applied'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    screeningNotes: {
      type: String
    },
    interviewDate: {
      type: Date
    },
    rejectionReason: {
      type: String
    },
    selectedAt: {
      type: Date
    },
    adminOverrideReason: {
      type: String
    },
    adminOverriddenAt: {
      type: Date
    },
    adminOverriddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Compound Index to prevent duplicate applications per student per drive
applicationSchema.index({ student: 1, drive: 1 }, { unique: true });
applicationSchema.index({ status: 1 });

const Application = mongoose.model('Application', applicationSchema);
module.exports = Application;
