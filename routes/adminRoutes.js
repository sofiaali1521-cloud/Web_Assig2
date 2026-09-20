const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAdmin);

router.get('/dashboard', adminController.getDashboard);
router.get('/recruiters', adminController.getRecruiters);

router.post('/recruiters/:id/verify', adminController.verifyRecruiter);
router.post('/recruiters/:id/reject', adminController.rejectRecruiter);
router.post('/users/:id/toggle-status', adminController.toggleUserStatus);

// Drive Management & Oversight
router.get('/drives', adminController.getDrives);
router.post('/drives/:id/status', adminController.updateDriveStatus);

// Global Applications Audit & Detailed Inspection
router.get('/applications', adminController.getApplications);
router.get('/applications/:id', adminController.getApplicationDetail);
router.post('/applications/:id/override-status', adminController.overrideApplicationStatus);
router.post('/students/:id/toggle-policy-exemption', adminController.toggleStudentPolicyExemption);

// Placement Records Monitoring & Management
router.get('/placements', adminController.getPlacements);
router.post('/placements/manual', adminController.createPlacementRecord);

module.exports = router;
