const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

// Validation Chains
const loginValidation = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address'),
  body('password').notEmpty().withMessage('Password is required')
];

const studentRegisterValidation = [
  body('name').trim().notEmpty().withMessage('Full name is required'),
  body('email').trim().isEmail().withMessage('Please enter a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('collegeId').trim().notEmpty().withMessage('College ID / Roll number is required'),
  body('branch').trim().notEmpty().withMessage('Branch is required'),
  body('course').trim().notEmpty().withMessage('Course is required'),
  body('graduationYear').isNumeric().withMessage('Graduation year must be a valid number'),
  body('cgpa').isFloat({ min: 0, max: 10 }).withMessage('CGPA must be a number between 0.0 and 10.0')
];

const recruiterRegisterValidation = [
  body('name').trim().notEmpty().withMessage('Full name is required'),
  body('email').trim().isEmail().withMessage('Please enter a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('designation').trim().notEmpty().withMessage('Designation is required')
];

// Routes
router.get('/login', authController.getLogin);
router.post('/login', loginValidation, authController.postLogin);

// Student Registration Routes
router.get('/register', authController.getStudentRegister);
router.get('/register/student', authController.getStudentRegister);
router.post('/register', studentRegisterValidation, authController.postStudentRegister);
router.post('/register/student', studentRegisterValidation, authController.postStudentRegister);

// Recruiter Registration Routes
router.get('/recruiter/register', authController.getRecruiterRegister);
router.get('/register/recruiter', authController.getRecruiterRegister);
router.post('/recruiter/register', recruiterRegisterValidation, authController.postRecruiterRegister);
router.post('/register/recruiter', recruiterRegisterValidation, authController.postRecruiterRegister);

router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

module.exports = router;
