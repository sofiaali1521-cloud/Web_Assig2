const express = require('express');
const { body } = require('express-validator');
const driveController = require('../controllers/driveController');
const { requireAuth, requireRecruiter, requireAdmin, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

const driveValidation = [
  body('title').trim().notEmpty().withMessage('Drive Title is required'),
  body('role').trim().notEmpty().withMessage('Job/Internship Role is required'),
  body('driveType').isIn(['placement', 'internship']).withMessage('Drive Type must be placement or internship'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('lastDate').isISO8601().withMessage('Last date to apply must be a valid date'),
  body('minimumCGPA').isFloat({ min: 0.0, max: 10.0 }).withMessage('Minimum CGPA must be between 0.0 and 10.0')
];

// Student & Public Drive Browse Routes
router.get('/', requireAuth, driveController.getStudentDrives);
router.get('/recruiter/manage', requireRole('recruiter', 'admin'), driveController.getRecruiterDrives);
router.get('/admin/manage', requireAdmin, driveController.getAdminDrives);

// Drive Creation Routes
router.get('/create', requireRole('recruiter', 'admin'), driveController.getCreateDrive);
router.get('/new', requireRole('recruiter', 'admin'), driveController.getCreateDrive);
router.post('/create', requireRole('recruiter', 'admin'), driveValidation, driveController.postCreateDrive);
router.post('/new', requireRole('recruiter', 'admin'), driveValidation, driveController.postCreateDrive);

// Specific Drive Detail / Edit Routes (must come after fixed named routes)
router.get('/:id', requireAuth, (req, res, next) => {
  if (['create', 'new', 'recruiter', 'admin'].includes(req.params.id)) {
    return next();
  }
  return driveController.getDriveDetail(req, res, next);
});
router.get('/:id/edit', requireRole('recruiter', 'admin'), driveController.getEditDrive);
router.post('/:id/edit', requireRole('recruiter', 'admin'), driveValidation, driveController.postEditDrive);
router.post('/:id/status', requireRole('recruiter', 'admin'), driveController.updateDriveStatus);

module.exports = router;
