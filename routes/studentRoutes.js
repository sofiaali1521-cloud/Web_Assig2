const express = require('express');
const { body } = require('express-validator');
const studentController = require('../controllers/studentController');
const { requireStudent } = require('../middleware/authMiddleware');
const { uploadResume } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Apply requireStudent guard to all student routes
router.use(requireStudent);

// Profile Validation Rules
const profileValidation = [
  body('fullName').trim().notEmpty().withMessage('Full Name is required'),
  body('collegeId').trim().notEmpty().withMessage('College Roll Number / ID is required'),
  body('branch').trim().notEmpty().withMessage('Branch is required'),
  body('course').trim().notEmpty().withMessage('Course is required'),
  body('graduationYear')
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Graduation Year must be between 2000 and 2100'),
  body('cgpa')
    .isFloat({ min: 0.0, max: 10.0 })
    .withMessage('CGPA must be a valid number between 0.0 and 10.0'),
  body('resumeLink')
    .optional({ checkFalsy: true })
    .custom((value) => {
      if (!value) return true;
      const isUrl = /^(https?:\/\/[^\s]+)$/.test(value);
      const isUpload = /^\/uploads\/[^\s]+$/.test(value);
      if (!isUrl && !isUpload) {
        throw new Error('Resume link must be a valid HTTP/HTTPS URL or uploaded file path');
      }
      return true;
    })
];

// Routes
router.get('/dashboard', studentController.getDashboard);
router.get('/profile', studentController.getProfile);
router.get('/profile/edit', studentController.getEditProfile);
router.post(
  '/profile/edit',
  uploadResume.single('resumeFile'),
  profileValidation,
  studentController.updateProfile
);

module.exports = router;
