const mongoose = require('mongoose');

const placementRecordSchema = new mongoose.Schema(
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
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required']
    },
    role: {
      type: String,
      required: [true, 'Job/Internship role is required'],
      trim: true
    },
    package: {
      type: Number,
      required: [true, 'Package/Compensation figure is required']
    },
    placementType: {
      type: String,
      enum: {
        values: ['full-time', 'internship', 'internship-to-full-time'],
        message: '{VALUE} is not a valid placement type'
      },
      required: [true, 'Placement type is required']
    },
    selectedAt: {
      type: Date,
      default: Date.now
    },
    joiningDate: {
      type: Date
    },
    status: {
      type: String,
      enum: {
        values: ['selected', 'joined', 'completed', 'withdrawn'],
        message: '{VALUE} is not a valid placement status'
      },
      default: 'selected'
    }
  },
  {
    timestamps: true
  }
);

placementRecordSchema.index({ student: 1 });
placementRecordSchema.index({ company: 1 });

const PlacementRecord = mongoose.model('PlacementRecord', placementRecordSchema);
module.exports = PlacementRecord;
