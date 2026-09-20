const express = require('express');
const { body } = require('express-validator');
const recruiterController = require('../controllers/recruiterController');
const driveController = require('../controllers/driveController');
const { requireRecruiter } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireRecruiter);

const recruiterValidation = [
  body('name').trim().notEmpty().withMessage('Recruiter Name is required'),
  body('designation').trim().notEmpty().withMessage('Designation is required'),
  body('website')
    .optional({ checkFalsy: true })
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Website must be a valid HTTP or HTTPS URL')
];

const driveValidation = [
  body('title').trim().notEmpty().withMessage('Drive Title is required'),
  body('role').trim().notEmpty().withMessage('Job/Internship Role is required'),
  body('driveType').isIn(['placement', 'internship']).withMessage('Drive Type must be placement or internship'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('lastDate').isISO8601().withMessage('Last date to apply must be a valid date'),
  body('minimumCGPA').isFloat({ min: 0.0, max: 10.0 }).withMessage('Minimum CGPA must be between 0.0 and 10.0')
];

// Dashboard
router.get('/dashboard', recruiterController.getDashboard);

// Company & Recruiter Profile Routes (with aliases)
router.get('/profile', recruiterController.getProfile);
router.get('/company', recruiterController.getProfile);

router.get('/profile/edit', recruiterController.getEditProfile);
router.get('/company/edit', recruiterController.getEditProfile);
router.get('/edit-profile', recruiterController.getEditProfile);

router.post('/profile/edit', recruiterValidation, recruiterController.updateProfile);
router.post('/company/edit', recruiterValidation, recruiterController.updateProfile);
router.post('/edit-profile', recruiterValidation, recruiterController.updateProfile);

// Drive Management Routes (with aliases)
router.get('/drives', driveController.getRecruiterDrives);
router.get('/drives/create', driveController.getCreateDrive);
router.post('/drives/create', driveValidation, driveController.postCreateDrive);

module.exports = router;
