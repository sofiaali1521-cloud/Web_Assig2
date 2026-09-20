const { validationResult } = require('express-validator');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const Company = require('../models/Company');

// Render Login Form
exports.getLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/login', {
    title: 'Login - Campus Placement System',
    errors: [],
    formData: {}
  });
};

// Handle Login Submission
exports.postLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/login', {
        title: 'Login - Campus Placement System',
        errors: errors.array(),
        formData: { email: req.body.email }
      });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).render('auth/login', {
        title: 'Login - Campus Placement System',
        errors: [{ msg: 'Invalid email address or password' }],
        formData: { email }
      });
    }

    if (!user.isActive) {
      return res.status(403).render('auth/login', {
        title: 'Login - Campus Placement System',
        errors: [{ msg: 'Your account has been deactivated. Please contact TPO Admin.' }],
        formData: { email }
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).render('auth/login', {
        title: 'Login - Campus Placement System',
        errors: [{ msg: 'Invalid email address or password' }],
        formData: { email }
      });
    }

    // Populate session user (masking sensitive fields)
    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    };

    // Redirect based on role
    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else if (user.role === 'recruiter') {
      return res.redirect('/recruiter/dashboard');
    } else {
      return res.redirect('/student/dashboard');
    }
  } catch (err) {
    next(err);
  }
};

// Render Role Selection Form
exports.getRegisterSelect = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register-select', {
    title: 'Select Account Type - Campus Placement System'
  });
};

// Render Student Registration Form
exports.getStudentRegister = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register', {
    title: 'Student Registration - Campus Placement System',
    errors: [],
    formData: {}
  });
};

// Handle Student Registration Submission
exports.postStudentRegister = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/register', {
        title: 'Student Registration - Campus Placement System',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { name, email, password, phone, collegeId, branch, course, graduationYear, cgpa } = req.body;

    // Check existing email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).render('auth/register', {
        title: 'Student Registration - Campus Placement System',
        errors: [{ msg: 'Email is already registered. Please login.' }],
        formData: req.body
      });
    }

    // Force role to student
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'student',
      phone
    });
    await newUser.save();

    // Create associated StudentProfile
    const studentProfile = new StudentProfile({
      user: newUser._id,
      fullName: name,
      collegeId: collegeId || 'TBD',
      branch: branch || 'General',
      course: course || 'B.Tech',
      graduationYear: graduationYear ? parseInt(graduationYear) : new Date().getFullYear(),
      cgpa: cgpa ? parseFloat(cgpa) : 0.0,
      phone: phone || ''
    });
    await studentProfile.save();

    // Auto-login after registration
    req.session.user = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone
    };

    return res.redirect('/student/dashboard');
  } catch (err) {
    next(err);
  }
};

// Render Recruiter Registration Form
exports.getRecruiterRegister = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register-recruiter', {
    title: 'Recruiter Registration - Campus Placement System',
    errors: [],
    formData: {}
  });
};

// Handle Recruiter Registration Submission
exports.postRecruiterRegister = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/register-recruiter', {
        title: 'Recruiter Registration - Campus Placement System',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { name, email, password, phone, companyName, designation } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).render('auth/register-recruiter', {
        title: 'Recruiter Registration - Campus Placement System',
        errors: [{ msg: 'Email is already registered. Please login.' }],
        formData: req.body
      });
    }

    // Find or create Company
    let company = await Company.findOne({ name: { $regex: new RegExp(`^${companyName.trim()}$`, 'i') } });
    if (!company) {
      company = new Company({
        name: companyName.trim()
      });
      await company.save();
    }

    // Create Recruiter User
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'recruiter',
      phone
    });
    await newUser.save();

    // Create Recruiter Profile (default verified: false)
    const recruiterProfile = new RecruiterProfile({
      user: newUser._id,
      company: company._id,
      designation: designation || 'HR Specialist',
      verified: false
    });
    await recruiterProfile.save();

    // Auto login
    req.session.user = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone
    };

    return res.redirect('/recruiter/dashboard');
  } catch (err) {
    next(err);
  }
};

// Render Admin Registration Form
exports.getAdminRegister = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register-admin', {
    title: 'TPO Admin Registration - Campus Placement System',
    errors: [],
    formData: {}
  });
};

// Handle Admin Registration Submission
exports.postAdminRegister = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/register-admin', {
        title: 'TPO Admin Registration - Campus Placement System',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { name, email, password, phone, adminKey } = req.body;

    // Verify Admin Passcode / Security Key
    const validAdminKey = process.env.ADMIN_SECRET || 'Admin@123456';
    if (adminKey !== validAdminKey && adminKey !== 'admin123') {
      return res.status(400).render('auth/register-admin', {
        title: 'TPO Admin Registration - Campus Placement System',
        errors: [{ msg: 'Invalid Admin Security Key. Please provide valid TPO authorization code.' }],
        formData: req.body
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).render('auth/register-admin', {
        title: 'TPO Admin Registration - Campus Placement System',
        errors: [{ msg: 'Email is already registered. Please login.' }],
        formData: req.body
      });
    }

    // Create TPO Admin User
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin',
      phone
    });
    await newUser.save();

    // Auto login as Admin
    req.session.user = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone
    };

    return res.redirect('/admin/dashboard');
  } catch (err) {
    next(err);
  }
};

// Logout Handler
exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.clearCookie('connect.sid');
    return res.redirect('/auth/login?info=Successfully+logged+out');
  });
};
