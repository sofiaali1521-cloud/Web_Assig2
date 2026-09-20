const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const Application = require('../models/Application');
const PlacementRecord = require('../models/PlacementRecord');
const Drive = require('../models/Drive');
const Company = require('../models/Company');
const inMemoryStore = require('../config/inMemoryStore');

const isDbConnected = () => mongoose.connection.readyState === 1;

// Helper to calculate profile completion percentage
const calculateCompletionStatus = (profile) => {
  let score = 0;
  if (profile.fullName && profile.fullName.trim()) score += 15;
  if (profile.collegeId && profile.collegeId.trim()) score += 15;
  if (profile.branch && profile.branch.trim()) score += 15;
  if (profile.graduationYear && profile.graduationYear > 0) score += 15;
  if (profile.cgpa !== undefined && profile.cgpa >= 0) score += 15;
  if (profile.skills && profile.skills.length > 0) score += 10;
  if (profile.resumeLink && profile.resumeLink.trim()) score += 15;
  return Math.min(score, 100);
};

// Render Data-Driven Student Dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const studentUserId = req.session.user._id;

    if (!isDbConnected()) {
      const profile = inMemoryStore.getStudentProfile(studentUserId);
      const completion = calculateCompletionStatus(profile);
      const apps = inMemoryStore.getStudentApplications(studentUserId);

      return res.render('student/dashboard', {
        title: 'Student Dashboard - Campus Placement System',
        profile,
        user: req.session.user,
        stats: {
          completion,
          totalApplications: apps.length,
          activeApplications: apps.length,
          shortlistedCount: 0,
          interviewedCount: 0,
          selectedCount: 0,
          rejectedCount: 0
        },
        placementStatus: apps.length > 0 ? 'Application in progress' : 'Not placed',
        placementDetails: null,
        recentApplications: [],
        upcomingInterviews: []
      });
    }
    let profile = await StudentProfile.findOne({ user: studentUserId })
      .populate('placedCompany')
      .populate('placedDrive');

    if (!profile) {
      profile = new StudentProfile({
        user: studentUserId,
        fullName: req.session.user.name,
        collegeId: '',
        branch: 'CSE',
        course: 'B.Tech',
        graduationYear: new Date().getFullYear(),
        cgpa: 0.0
      });
      await profile.save();
    }

    const completion = calculateCompletionStatus(profile);
    if (profile.profileCompletionStatus !== completion) {
      profile.profileCompletionStatus = completion;
      await profile.save();
    }

    // Real-Time MongoDB Analytics Queries (Scoped strictly to logged-in student)
    const totalApplications = await Application.countDocuments({ student: studentUserId });
    const activeApplications = await Application.countDocuments({ student: studentUserId, status: { $in: ['applied', 'shortlisted', 'interviewed'] } });
    const shortlistedCount = await Application.countDocuments({ student: studentUserId, status: 'shortlisted' });
    const interviewedCount = await Application.countDocuments({ student: studentUserId, status: 'interviewed' });
    const selectedCount = await Application.countDocuments({ student: studentUserId, status: 'selected' });
    const rejectedCount = await Application.countDocuments({ student: studentUserId, status: 'rejected' });

    // Recent 5 Applications
    const recentApplications = await Application.find({ student: studentUserId })
      .populate({
        path: 'drive',
        populate: { path: 'company' }
      })
      .sort({ appliedAt: -1 })
      .limit(5);

    // Upcoming Scheduled Interviews
    const upcomingInterviews = await Application.find({
      student: studentUserId,
      $or: [
        { status: 'interviewed' },
        { interviewDate: { $gte: new Date() } }
      ]
    })
      .populate({
        path: 'drive',
        populate: { path: 'company' }
      })
      .sort({ interviewDate: 1, appliedAt: -1 });

    // Placement Record (If Placed)
    const placementRecord = await PlacementRecord.findOne({ student: studentUserId, status: 'selected' })
      .populate('company')
      .populate('drive');

    // Placement Status Calculation
    let placementStatus = 'Not placed';
    let placementDetails = null;

    if (selectedCount > 0 || placementRecord || profile.isPlaced) {
      placementStatus = 'Selected / Placed';
      const compObj = placementRecord ? placementRecord.company : profile.placedCompany;
      placementDetails = {
        companyName: compObj ? (compObj.name || compObj.companyName) : 'Target Recruiting Partner',
        role: placementRecord ? placementRecord.role : (profile.placedDrive ? profile.placedDrive.role : 'Software Engineer'),
        package: placementRecord ? placementRecord.package : (profile.placedPackage || 'N/A')
      };
    } else if (activeApplications > 0) {
      placementStatus = 'Application in progress';
    }

    res.render('student/dashboard', {
      title: 'Student Dashboard - Campus Placement System',
      profile,
      user: req.session.user,
      stats: {
        completion,
        totalApplications,
        activeApplications,
        shortlistedCount,
        interviewedCount,
        selectedCount,
        rejectedCount
      },
      placementStatus,
      placementDetails,
      recentApplications,
      upcomingInterviews
    });
  } catch (err) {
    next(err);
  }
};

// Render View Student Profile
exports.getProfile = async (req, res, next) => {
  try {
    const studentUserId = req.session.user._id;

    if (!isDbConnected()) {
      const profile = inMemoryStore.getStudentProfile(studentUserId);
      const completion = calculateCompletionStatus(profile);
      return res.render('student/profile', {
        title: `${profile.fullName} - Student Profile`,
        profile,
        completion
      });
    }

    let profile = await StudentProfile.findOne({ user: studentUserId });

    if (!profile) {
      return res.redirect('/student/profile/edit');
    }

    const completion = calculateCompletionStatus(profile);

    res.render('student/profile', {
      title: `${profile.fullName} - Student Profile`,
      profile,
      completion
    });
  } catch (err) {
    next(err);
  }
};

// Render Edit Profile Form
exports.getEditProfile = async (req, res, next) => {
  try {
    const studentUserId = req.session.user._id;

    if (!isDbConnected()) {
      const profile = inMemoryStore.getStudentProfile(studentUserId);
      return res.render('student/edit-profile', {
        title: 'Edit Student Profile',
        profile,
        skillsString: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
        errors: [],
        success: req.query.success || null
      });
    }

    let profile = await StudentProfile.findOne({ user: studentUserId });

    if (!profile) {
      profile = {
        fullName: req.session.user.name,
        collegeId: '',
        branch: 'CSE',
        course: 'B.Tech',
        graduationYear: new Date().getFullYear(),
        cgpa: 0.0,
        skills: [],
        resumeLink: '',
        phone: req.session.user.phone || ''
      };
    }

    res.render('student/edit-profile', {
      title: 'Edit Student Profile',
      profile,
      skillsString: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
      errors: [],
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
};

// Handle Update Profile Submission
exports.updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const { fullName, collegeId, branch, course, graduationYear, cgpa, skills, resumeLink, phone, countryCode, phoneNumber } = req.body;
    const studentUserId = req.session.user._id;

    // Combine country code and phone number if present
    let finalPhone = phone ? phone.trim() : '';
    if (countryCode && phoneNumber) {
      finalPhone = `${countryCode} ${phoneNumber.trim()}`;
    } else if (countryCode && !phoneNumber) {
      finalPhone = countryCode.trim();
    }

    // Convert comma-separated skills to trimmed array
    const parsedSkills = typeof skills === 'string'
      ? skills.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    if (!errors.isEmpty()) {
      return res.status(400).render('student/edit-profile', {
        title: 'Edit Student Profile',
        profile: {
          fullName,
          collegeId,
          branch,
          course,
          graduationYear,
          cgpa,
          resumeLink,
          phone
        },
        skillsString: skills || '',
        errors: errors.array(),
        success: null
      });
    }

    if (!isDbConnected()) {
      let profileData = {
        fullName: fullName.trim(),
        collegeId: collegeId.trim(),
        branch: branch.trim(),
        course: course.trim(),
        graduationYear: parseInt(graduationYear),
        cgpa: parseFloat(cgpa),
        skills: parsedSkills,
        resumeLink: resumeLink ? resumeLink.trim() : '',
        phone: finalPhone
      };
      if (req.file) {
        profileData.resumeLink = `/uploads/resumes/${req.file.filename}`;
      }
      inMemoryStore.updateStudentProfile(studentUserId, profileData);
      req.session.user.name = profileData.fullName;
      req.session.user.phone = profileData.phone;
      return res.redirect('/student/profile?success=Profile+updated+successfully');
    }

    let profile = await StudentProfile.findOne({ user: studentUserId });
    if (!profile) {
      profile = new StudentProfile({ user: studentUserId });
    }

    // Handle uploaded file vs provided URL vs existing link
    let finalResumeLink = profile.resumeLink || '';
    if (req.file) {
      finalResumeLink = `/uploads/resumes/${req.file.filename}`;
    } else if (resumeLink && resumeLink.trim()) {
      finalResumeLink = resumeLink.trim();
    }

    profile.fullName = fullName.trim();
    profile.collegeId = collegeId.trim();
    profile.branch = branch.trim();
    profile.course = course.trim();
    profile.graduationYear = parseInt(graduationYear);
    profile.cgpa = parseFloat(cgpa);
    profile.skills = parsedSkills;
    profile.resumeLink = finalResumeLink;
    profile.phone = finalPhone;
    profile.profileCompletionStatus = calculateCompletionStatus(profile);

    await profile.save();

    // Sync updated name and phone back to User model & session
    await User.findByIdAndUpdate(studentUserId, {
      name: profile.fullName,
      phone: profile.phone
    });

    req.session.user.name = profile.fullName;
    req.session.user.phone = profile.phone;

    return res.redirect('/student/profile?success=Profile+updated+successfully');
  } catch (err) {
    next(err);
  }
};
