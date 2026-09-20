const mongoose = require('mongoose');

const driveSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required']
    },
    title: {
      type: String,
      required: [true, 'Drive title is required'],
      trim: true
    },
    role: {
      type: String,
      required: [true, 'Job/Internship role is required'],
      trim: true
    },
    driveType: {
      type: String,
      enum: {
        values: ['placement', 'internship'],
        message: '{VALUE} is not a valid drive type'
      },
      required: [true, 'Drive type (placement/internship) is required']
    },
    description: {
      type: String,
      required: [true, 'Drive description is required']
    },
    package: {
      type: Number,
      default: 0
    },
    stipend: {
      type: Number,
      default: 0
    },
    location: {
      type: String,
      trim: true
    },
    workMode: {
      type: String,
      enum: {
        values: ['on-site', 'remote', 'hybrid'],
        message: '{VALUE} is not a valid work mode'
      },
      default: 'on-site'
    },
    eligibleBranches: {
      type: [String],
      required: [true, 'At least one eligible branch is required']
    },
    minimumCGPA: {
      type: Number,
      required: [true, 'Minimum CGPA is required'],
      min: [0, 'CGPA cannot be negative'],
      max: [10, 'CGPA cannot exceed 10.0'],
      default: 0
    },
    requiredSkills: {
      type: [String],
      default: []
    },
    graduationYears: {
      type: [Number],
      required: [true, 'Target graduation years are required']
    },
    lastDate: {
      type: Date,
      required: [true, 'Last date to apply is required']
    },
    driveDate: {
      type: Date
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'closed', 'cancelled'],
        message: '{VALUE} is not a valid drive status'
      },
      default: 'draft'
    },
    totalOpenings: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

// Indexes for common search queries
driveSchema.index({ company: 1 });
driveSchema.index({ status: 1 });
driveSchema.index({ lastDate: 1 });

const Drive = mongoose.model('Drive', driveSchema);
module.exports = Drive;
