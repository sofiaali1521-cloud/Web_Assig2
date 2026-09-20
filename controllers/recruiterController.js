const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const RecruiterProfile = require('../models/RecruiterProfile');
const Company = require('../models/Company');
const User = require('../models/User');
const Drive = require('../models/Drive');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
const inMemoryStore = require('../config/inMemoryStore');

const isDbConnected = () => mongoose.connection.readyState === 1;

// Render Recruiter Dashboard (Company & Recruiter Scoped Analytics)
exports.getDashboard = async (req, res, next) => {
  try {
    const recruiterUserId = req.session.user._id;

    if (!isDbConnected()) {
      const profile = inMemoryStore.getRecruiterProfile(recruiterUserId);
      const company = inMemoryStore.companies[0];
      const drives = inMemoryStore.drives;

      return res.render('recruiter/dashboard', {
        title: 'Recruiter Dashboard - Campus Placement System',
        profile,
        company,
        user: req.session.user,
        stats: {
          totalDrives: drives.length,
          publishedDrives: drives.length,
          draftDrives: 0,
          closedDrives: 0,
          cancelledDrives: 0,
          totalApplicants: inMemoryStore.applications.length,
          appliedCount: inMemoryStore.applications.length,
          shortlistedCount: 0,
          interviewedCount: 0,
          selectedCount: 0,
          rejectedCount: 0,
          withdrawnCount: 0
        },
        recentDrives: drives,
        recentApplicants: [],
        upcomingInterviews: []
      });
    }
    let profile = await RecruiterProfile.findOne({ user: recruiterUserId })
      .populate('user')
      .populate('company');

    if (!profile) {
      return res.status(404).send('Recruiter profile not found');
    }

    // Drives Created by Recruiter / Company
    const totalDrives = await Drive.countDocuments({ createdBy: recruiterUserId });
    const publishedDrives = await Drive.countDocuments({ createdBy: recruiterUserId, status: 'published' });
    const draftDrives = await Drive.countDocuments({ createdBy: recruiterUserId, status: 'draft' });
    const closedDrives = await Drive.countDocuments({ createdBy: recruiterUserId, status: 'closed' });
    const cancelledDrives = await Drive.countDocuments({ createdBy: recruiterUserId, status: 'cancelled' });

    // Fetch drive IDs to query applications
    const recruiterDrives = await Drive.find({ createdBy: recruiterUserId }).select('_id title role driveType status createdAt');
    const recruiterDriveIds = recruiterDrives.map(d => d._id);

    // Applicant Metrics across recruiter drives
    const totalApplicants = await Application.countDocuments({ drive: { $in: recruiterDriveIds } });
    const shortlistedCount = await Application.countDocuments({ drive: { $in: recruiterDriveIds }, status: 'shortlisted' });
    const interviewedCount = await Application.countDocuments({ drive: { $in: recruiterDriveIds }, status: 'interviewed' });
    const selectedCount = await Application.countDocuments({ drive: { $in: recruiterDriveIds }, status: 'selected' });
    const rejectedCount = await Application.countDocuments({ drive: { $in: recruiterDriveIds }, status: 'rejected' });
    const appliedCount = await Application.countDocuments({ drive: { $in: recruiterDriveIds }, status: 'applied' });
    const withdrawnCount = await Application.countDocuments({ drive: { $in: recruiterDriveIds }, status: 'withdrawn' });

    // Recent 5 Drives
    const recentDrives = await Drive.find({ createdBy: recruiterUserId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Recent 5 Applicants
    const recentApplicants = await Application.find({ drive: { $in: recruiterDriveIds } })
      .populate('student')
      .populate('drive')
      .sort({ appliedAt: -1 })
      .limit(5);

    // Upcoming Scheduled Interviews
    const upcomingInterviews = await Application.find({
      drive: { $in: recruiterDriveIds },
      $or: [
        { status: 'interviewed' },
        { interviewDate: { $gte: new Date() } }
      ]
    })
      .populate('student')
      .populate('drive')
      .sort({ interviewDate: 1, appliedAt: -1 });

    res.render('recruiter/dashboard', {
      title: 'Recruiter Dashboard - Campus Placement System',
      profile,
      company: profile.company,
      user: req.session.user,
      stats: {
        totalDrives,
        publishedDrives,
        draftDrives,
        closedDrives,
        cancelledDrives,
        totalApplicants,
        appliedCount,
        shortlistedCount,
        interviewedCount,
        selectedCount,
        rejectedCount,
        withdrawnCount
      },
      recentDrives,
      recentApplicants,
      upcomingInterviews
    });
  } catch (err) {
    next(err);
  }
};

// Render Recruiter & Company Profile View
exports.getProfile = async (req, res, next) => {
  try {
    const recruiterUserId = req.session.user._id;

    if (!isDbConnected()) {
      const profile = inMemoryStore.getRecruiterProfile(recruiterUserId);
      const company = inMemoryStore.companies[0];
      return res.render('recruiter/profile', {
        title: `${req.session.user.name} - Recruiter Profile`,
        profile: { ...profile, user: req.session.user },
        company
      });
    }

    const profile = await RecruiterProfile.findOne({ user: recruiterUserId })
      .populate('user')
      .populate('company');

    if (!profile) {
      return res.redirect('/auth/login');
    }

    res.render('recruiter/profile', {
      title: `${profile.user.name} - Recruiter Profile`,
      profile,
      company: profile.company
    });
  } catch (err) {
    next(err);
  }
};

// Render Edit Profile & Company Form
exports.getEditProfile = async (req, res, next) => {
  try {
    const recruiterUserId = req.session.user._id;

    if (!isDbConnected()) {
      const profile = inMemoryStore.getRecruiterProfile(recruiterUserId);
      const company = inMemoryStore.companies[0];
      return res.render('recruiter/edit-profile', {
        title: 'Edit Recruiter & Company Profile',
        profile: { ...profile, user: req.session.user },
        company,
        errors: [],
        success: req.query.success || null
      });
    }

    const profile = await RecruiterProfile.findOne({ user: recruiterUserId })
      .populate('user')
      .populate('company');

    if (!profile) {
      return res.redirect('/auth/login');
    }

    res.render('recruiter/edit-profile', {
      title: 'Edit Recruiter & Company Profile',
      profile,
      company: profile.company,
      errors: [],
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
};

// Handle Update Profile & Company Info Submission
exports.updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const recruiterUserId = req.session.user._id;
    const { name, designation, phone, countryCode, phoneNumber, website, industry, description, location, logo } = req.body;

    if (!isDbConnected()) {
      const profile = inMemoryStore.getRecruiterProfile(recruiterUserId);
      profile.designation = designation ? designation.trim() : 'HR Specialist';
      req.session.user.name = name ? name.trim() : req.session.user.name;
      return res.redirect('/recruiter/profile?success=Profile+and+company+information+updated+successfully');
    }

    if (!profile) {
      return res.redirect('/auth/login');
    }

    // Combine country code and phone number if present
    let finalPhone = phone ? phone.trim() : '';
    if (countryCode && phoneNumber) {
      finalPhone = `${countryCode} ${phoneNumber.trim()}`;
    } else if (countryCode && !phoneNumber) {
      finalPhone = countryCode.trim();
    }

    if (!errors.isEmpty()) {
      return res.status(400).render('recruiter/edit-profile', {
        title: 'Edit Recruiter & Company Profile',
        profile: {
          ...profile.toObject(),
          designation
        },
        company: {
          ...profile.company.toObject(),
          website,
          industry,
          description,
          location,
          logo
        },
        errors: errors.array(),
        success: null
      });
    }

    // Update Recruiter Profile & User Name/Phone
    profile.designation = designation.trim();
    await profile.save();

    await User.findByIdAndUpdate(recruiterUserId, {
      name: name.trim(),
      phone: finalPhone
    });

    req.session.user.name = name.trim();
    req.session.user.phone = finalPhone;

    // Update Linked Company Metadata
    if (profile.company) {
      await Company.findByIdAndUpdate(profile.company._id, {
        website: website ? website.trim() : '',
        industry: industry ? industry.trim() : '',
        description: description ? description.trim() : '',
        location: location ? location.trim() : '',
        logo: logo ? logo.trim() : ''
      });
    }

    return res.redirect('/recruiter/profile?success=Profile+and+company+information+updated+successfully');
  } catch (err) {
    next(err);
  }
};
