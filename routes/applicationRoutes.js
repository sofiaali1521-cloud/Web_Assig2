const express = require('express');
const applicationController = require('../controllers/applicationController');
const { requireStudent, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Student Application Routes
router.get('/drives/:id/apply', requireStudent, applicationController.getApplyDrive);
router.post('/drives/:id/apply', requireStudent, applicationController.postApplyDrive);

router.get('/student/applications', requireStudent, applicationController.getStudentApplications);
router.get('/student/applications/:id', requireStudent, applicationController.getStudentApplicationDetail);
router.get('/student/placements', requireStudent, applicationController.getStudentPlacements);
router.post('/student/applications/:id/withdraw', requireStudent, applicationController.withdrawApplication);

// Recruiter Applicant Management Routes
router.get('/recruiter/drives/:driveId/applicants', requireRole('recruiter', 'admin'), applicationController.getDriveApplicants);
router.get('/recruiter/applications/:id', requireRole('recruiter', 'admin'), applicationController.getApplicantDetail);
router.post('/recruiter/applications/:id/status', requireRole('recruiter', 'admin'), applicationController.updateApplicantStatus);

module.exports = router;
