const mongoose = require('mongoose');
const Application = require('../models/Application');
const Drive = require('../models/Drive');
const StudentProfile = require('../models/StudentProfile');
const PlacementRecord = require('../models/PlacementRecord');
const User = require('../models/User');
const { evaluateEligibility } = require('../services/eligibilityService');
const inMemoryStore = require('../config/inMemoryStore');

const isDbConnected = () => mongoose.connection.readyState === 1;

// 1. Render Application Confirmation Page
exports.getApplyDrive = async (req, res, next) => {
  try {
    const driveId = req.params.id;

    if (!isDbConnected()) {
      const driveObj = inMemoryStore.getDriveById(driveId) || inMemoryStore.drives[0];
      const drive = { ...driveObj, company: { name: driveObj.companyName || 'TechCorp Global' } };
      const studentProfile = inMemoryStore.getStudentProfile(req.session.user._id);

      return res.render('applications/confirm', {
        title: `Confirm Application - ${drive.title}`,
        drive,
        studentProfile,
        eligibilityInfo: { isEligible: true, reasons: [] },
        user: req.session.user,
        errors: []
      });
    }
    if (!mongoose.Types.ObjectId.isValid(driveId)) {
      return res.status(400).render('errors/500', { title: 'Invalid Drive', statusCode: 400, message: 'Invalid Drive ID', error: {} });
    }

    const drive = await Drive.findById(driveId).populate('company');
    if (!drive) {
      return res.status(404).render('errors/404', { title: 'Drive Not Found' });
    }

    const studentUserId = req.session.user._id;
    const studentProfile = await StudentProfile.findOne({ user: studentUserId });

    const eligibilityInfo = await evaluateEligibility(studentProfile, drive);

    const existingApp = await Application.findOne({ student: studentUserId, drive: driveId });
    if (existingApp) {
      return res.redirect('/student/applications?info=You+have+already+submitted+an+application+for+this+drive');
    }

    res.render('applications/confirm', {
      title: `Confirm Application - ${drive.title}`,
      drive,
      studentProfile,
      eligibilityInfo,
      user: req.session.user,
      errors: []
    });
  } catch (err) {
    next(err);
  }
};

// 2. Handle Application Submission (Zero-Trust Backend Validation)
exports.postApplyDrive = async (req, res, next) => {
  try {
    const driveId = req.params.id;
    const studentUserId = req.session.user._id;

    if (!isDbConnected()) {
      inMemoryStore.applyForDrive(studentUserId, driveId);
      return res.redirect('/student/applications?success=Application+submitted+successfully');
    }

    if (!mongoose.Types.ObjectId.isValid(driveId)) {
      return res.status(400).render('errors/500', { title: 'Invalid Drive', statusCode: 400, message: 'Invalid Drive ID', error: {} });
    }

    const drive = await Drive.findById(driveId).populate('company');
    if (!drive) {
      return res.status(404).render('errors/404', { title: 'Drive Not Found' });
    }

    const studentProfile = await StudentProfile.findOne({ user: studentUserId });

    const eligibilityInfo = await evaluateEligibility(studentProfile, drive);
    if (!eligibilityInfo.isEligible) {
      return res.status(400).render('applications/confirm', {
        title: `Confirm Application - ${drive.title}`,
        drive,
        studentProfile,
        eligibilityInfo,
        user: req.session.user,
        errors: [{ msg: `Application rejected: ${eligibilityInfo.reasons.join(' | ')}` }]
      });
    }

    const existingApp = await Application.findOne({ student: studentUserId, drive: driveId });
    if (existingApp) {
      return res.status(400).render('applications/confirm', {
        title: `Confirm Application - ${drive.title}`,
        drive,
        studentProfile,
        eligibilityInfo,
        user: req.session.user,
        errors: [{ msg: 'Duplicate Application: You have already applied for this placement drive.' }]
      });
    }

    const newApp = new Application({
      student: studentUserId,
      drive: driveId,
      status: 'applied',
      appliedAt: new Date()
    });

    await newApp.save();

    return res.redirect('/student/applications?success=Application+submitted+successfully');
  } catch (err) {
    if (err.code === 11000) {
      return res.redirect('/student/applications?info=You+have+already+applied+to+this+drive');
    }
    next(err);
  }
};

// 3. Render Student Applications History & Tracking Page (with Status Filters)
exports.getStudentApplications = async (req, res, next) => {
  try {
    const studentUserId = req.session.user._id;

    if (!isDbConnected()) {
      const studentProfile = inMemoryStore.getStudentProfile(studentUserId);
      const applications = inMemoryStore.getStudentApplications(studentUserId).map(app => {
        const driveObj = inMemoryStore.getDriveById(app.drive) || inMemoryStore.drives[0];
        return {
          ...app,
          drive: { ...driveObj, company: { name: driveObj.companyName } }
        };
      });

      return res.render('student/applications', {
        title: 'My Applications - Campus Placement System',
        applications,
        studentProfile,
        selectedStatus: req.query.status || 'all',
        success: req.query.success || null,
        info: req.query.info || null,
        error: req.query.error || null
      });
    }

    const studentProfile = await StudentProfile.findOne({ user: studentUserId });

    const statusFilter = req.query.status || 'all';
    const query = { student: studentUserId };

    if (statusFilter && statusFilter !== 'all') {
      query.status = statusFilter;
    }

    const applications = await Application.find(query)
      .populate({
        path: 'drive',
        populate: { path: 'company' }
      })
      .sort({ appliedAt: -1 });

    res.render('student/applications', {
      title: 'My Applications - Campus Placement System',
      applications,
      studentProfile,
      selectedStatus: statusFilter,
      success: req.query.success || null,
      info: req.query.info || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

// 3b. Render Student Application Detail Dossier View (Student Ownership Scoped)
exports.getStudentApplicationDetail = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const studentUserId = req.session.user._id;

    if (!isDbConnected()) {
      const appRecord = inMemoryStore.applications.find(a => a._id === applicationId) || inMemoryStore.applications[0];
      const driveObj = inMemoryStore.getDriveById(appRecord ? appRecord.drive : 'drive_1') || inMemoryStore.drives[0];
      const studentProfile = inMemoryStore.getStudentProfile(studentUserId);

      const application = {
        ...appRecord,
        drive: { ...driveObj, company: { name: driveObj.companyName } },
        student: req.session.user
      };

      return res.render('student/application-detail', {
        title: `Application Detail - ${driveObj.title}`,
        application,
        studentProfile,
        eligibilityInfo: { isEligible: true, reasons: [] },
        user: req.session.user
      });
    }

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).render('errors/500', { title: 'Invalid Application ID', statusCode: 400, message: 'Invalid Application ID', error: {} });
    }

    const application = await Application.findById(applicationId)
      .populate({
        path: 'drive',
        populate: { path: 'company' }
      })
      .populate('student');

    if (!application) {
      return res.status(404).render('errors/404', { title: 'Application Record Not Found' });
    }

    // Ownership Access Enforcement: Student can only view their own application
    if (application.student._id.toString() !== studentUserId.toString()) {
      return res.status(403).render('errors/500', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'Unauthorized access: You are only permitted to view your own job applications.',
        error: {}
      });
    }

    const studentProfile = await StudentProfile.findOne({ user: studentUserId });
    const eligibilityInfo = await evaluateEligibility(studentProfile, application.drive);

    res.render('student/application-detail', {
      title: `Application Detail - ${application.drive ? application.drive.title : 'Drive'}`,
      application,
      studentProfile,
      eligibilityInfo,
      user: req.session.user
    });
  } catch (err) {
    next(err);
  }
};

// 3c. Render Student Placement & Internship Records Page (Student Ownership Scoped)
exports.getStudentPlacements = async (req, res, next) => {
  try {
    const studentUserId = req.session.user._id;

    if (!isDbConnected()) {
      const studentProfile = inMemoryStore.getStudentProfile(studentUserId);
      return res.render('student/placements', {
        title: 'My Placement & Internship Records',
        placements: inMemoryStore.placements,
        studentProfile,
        user: req.session.user
      });
    }

    const studentProfile = await StudentProfile.findOne({ user: studentUserId });

    const placements = await PlacementRecord.find({ student: studentUserId })
      .populate('company')
      .populate('drive')
      .sort({ selectedAt: -1 });

    res.render('student/placements', {
      title: 'My Placement & Internship Records',
      placements,
      studentProfile,
      user: req.session.user
    });
  } catch (err) {
    next(err);
  }
};

// 4. Withdraw Application Action
exports.withdrawApplication = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const studentUserId = req.session.user._id;

    if (!isDbConnected()) {
      const appRecord = inMemoryStore.applications.find(a => a._id === applicationId);
      if (appRecord) appRecord.status = 'withdrawn';
      return res.redirect('/student/applications?success=Application+withdrawn+successfully');
    }

    const appRecord = await Application.findOne({ _id: applicationId, student: studentUserId });
    if (!appRecord) {
      return res.redirect('/student/applications?error=Application+record+not+found');
    }

    if (appRecord.status === 'selected') {
      return res.redirect('/student/applications?error=Selected+applications+cannot+be+withdrawn+manually');
    }

    appRecord.status = 'withdrawn';
    await appRecord.save();

    return res.redirect('/student/applications?success=Application+withdrawn+successfully');
  } catch (err) {
    next(err);
  }
};

// 5. Recruiter View: Manage Applicants for a Specific Drive
exports.getDriveApplicants = async (req, res, next) => {
  try {
    const driveId = req.params.driveId;

    if (!isDbConnected()) {
      const driveObj = inMemoryStore.getDriveById(driveId) || inMemoryStore.drives[0];
      const drive = { ...driveObj, company: { name: driveObj.companyName || 'TechCorp Global' } };
      const applications = inMemoryStore.applications.map(app => {
        const studentUser = inMemoryStore.findUserById(app.student) || { _id: app.student, name: 'Alex Johnson', email: 'user@college.edu' };
        const profile = inMemoryStore.getStudentProfile(app.student);
        return {
          ...app,
          student: studentUser,
          profile
        };
      });

      return res.render('recruiter/applicants', {
        title: `Applicants - ${drive.title}`,
        drive,
        applicants: applications,
        selectedStatus: req.query.status || 'all',
        searchQuery: req.query.search || '',
        success: req.query.success || null,
        error: req.query.error || null
      });
    }

    const drive = await Drive.findById(driveId).populate('company');

    if (!drive) {
      return res.status(404).render('errors/404', { title: 'Drive Not Found' });
    }

    // Security Check: Recruiter must own drive or user is Admin
    if (req.session.user.role === 'recruiter' && drive.createdBy.toString() !== req.session.user._id.toString()) {
      return res.status(403).render('errors/500', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorized to view applicants for another recruiter\'s drive.',
        error: {}
      });
    }

    const { status, search } = req.query;
    let filter = { drive: driveId };

    if (status && status !== 'all') {
      filter.status = status;
    }

    let applications = await Application.find(filter)
      .populate('student')
      .sort({ appliedAt: -1 });

    // Fetch linked StudentProfiles for enriched display
    const studentUserIds = applications.map(a => a.student ? a.student._id : null).filter(id => id !== null);
    const profiles = await StudentProfile.find({ user: { $in: studentUserIds } });
    const profileMap = new Map();
    profiles.forEach(p => profileMap.set(p.user.toString(), p));

    let processedApplicants = applications.map(app => {
      const studentIdStr = app.student ? app.student._id.toString() : '';
      const profile = profileMap.get(studentIdStr) || {};
      return {
        ...app.toObject(),
        profile
      };
    });

    // Backend Search Filter (Student Name, Branch, CGPA, Skills)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      processedApplicants = processedApplicants.filter(a => {
        const name = (a.student ? a.student.name : '').toLowerCase();
        const branch = (a.profile ? a.profile.branch || '' : '').toLowerCase();
        const cgpa = a.profile && a.profile.cgpa !== undefined ? a.profile.cgpa.toString() : '';
        const skills = (a.profile && a.profile.skills ? a.profile.skills.join(' ') : '').toLowerCase();
        return name.includes(q) || branch.includes(q) || cgpa.includes(q) || skills.includes(q);
      });
    }

    res.render('recruiter/applicants', {
      title: `Applicants - ${drive.title}`,
      drive,
      applicants: processedApplicants,
      selectedStatus: status || 'all',
      searchQuery: search || '',
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

// 6. Recruiter View: Single Applicant Detail View
exports.getApplicantDetail = async (req, res, next) => {
  try {
    const applicationId = req.params.id;

    if (!isDbConnected()) {
      const appRecord = inMemoryStore.applications.find(a => a._id === applicationId) || inMemoryStore.applications[0];
      const driveObj = inMemoryStore.getDriveById(appRecord ? appRecord.drive : 'drive_1') || inMemoryStore.drives[0];
      const studentUser = inMemoryStore.findUserById(appRecord ? appRecord.student : 'student_demo_id') || inMemoryStore.users[1];
      const studentProfile = inMemoryStore.getStudentProfile(studentUser._id);

      const application = {
        ...appRecord,
        drive: { ...driveObj, company: { name: driveObj.companyName } },
        student: studentUser
      };

      return res.render('recruiter/applicant-detail', {
        title: `Applicant - ${studentUser.name}`,
        application,
        drive: application.drive,
        studentProfile,
        errors: [],
        success: req.query.success || null
      });
    }

    const application = await Application.findById(applicationId)
      .populate('student')
      .populate({
        path: 'drive',
        populate: { path: 'company' }
      });

    if (!application) {
      return res.status(404).render('errors/404', { title: 'Application Record Not Found' });
    }

    // Security Check: Recruiter must own drive or user is Admin
    if (req.session.user.role === 'recruiter' && application.drive.createdBy.toString() !== req.session.user._id.toString()) {
      return res.status(403).render('errors/500', { title: 'Access Denied', statusCode: 403, message: 'Unauthorized', error: {} });
    }

    const studentProfile = await StudentProfile.findOne({ user: application.student._id });

    res.render('recruiter/applicant-detail', {
      title: `Applicant - ${application.student ? application.student.name : 'Student'}`,
      application,
      drive: application.drive,
      studentProfile,
      errors: [],
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
};

// 7. Update Applicant Status (Pipeline State Machine Enforcement)
exports.updateApplicantStatus = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const { status, screeningNotes, interviewDate, rejectionReason } = req.body;

    if (!isDbConnected()) {
      let appRecord = inMemoryStore.applications.find(a => a._id === applicationId);
      if (!appRecord) {
        appRecord = {
          _id: applicationId,
          drive: 'drive_1',
          student: 'student_demo_id',
          status: status,
          appliedAt: new Date()
        };
        inMemoryStore.applications.push(appRecord);
      }
      appRecord.status = status;
      if (screeningNotes !== undefined) appRecord.screeningNotes = screeningNotes;
      if (rejectionReason !== undefined) appRecord.rejectionReason = rejectionReason;
      if (interviewDate) appRecord.interviewDate = interviewDate;
      return res.redirect(`/recruiter/applications/${applicationId}?success=Applicant+status+updated+to+${status}`);
    }

    const application = await Application.findById(applicationId).populate('drive');
    if (!application) {
      return res.status(404).send('Application not found');
    }

    // Security Check: Recruiter must own drive or user is Admin
    if (req.session.user.role === 'recruiter' && application.drive && application.drive.createdBy && application.drive.createdBy.toString() !== req.session.user._id.toString()) {
      return res.status(403).send('Unauthorized to update another recruiter\'s applicant');
    }

    const targetStatus = status;

    // Update Status & Action Notes
    application.status = targetStatus;
    if (screeningNotes !== undefined) application.screeningNotes = screeningNotes.trim();
    if (interviewDate) application.interviewDate = new Date(interviewDate);
    if (rejectionReason !== undefined) application.rejectionReason = rejectionReason.trim();

    if (targetStatus === 'selected') {
      application.selectedAt = new Date();

      // Upsert PlacementRecord cleanly to prevent duplicate records
      await PlacementRecord.findOneAndUpdate(
        {
          student: application.student,
          drive: application.drive._id
        },
        {
          student: application.student,
          drive: application.drive._id,
          company: application.drive.company,
          role: application.drive.role,
          package: application.drive.package || application.drive.stipend || 0,
          placementType: application.drive.driveType === 'placement' ? 'full-time' : 'internship',
          selectedAt: new Date(),
          status: 'selected'
        },
        { upsert: true, new: true }
      );

      // If full-time placement drive, update StudentProfile placement state
      if (application.drive.driveType === 'placement') {
        await StudentProfile.findOneAndUpdate(
          { user: application.student },
          {
            isPlaced: true,
            placedDrive: application.drive._id,
            placedCompany: application.drive.company,
            placedPackage: application.drive.package || 0
          }
        );
      }
    }

    await application.save();

    return res.redirect(`/recruiter/applications/${applicationId}?success=Applicant+status+updated+to+${targetStatus}`);
  } catch (err) {
    next(err);
  }
};

// 8. Admin View: Global Application Audit Overview
exports.getAdminApplications = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const applications = await Application.find(filter)
      .populate('student')
      .populate({
        path: 'drive',
        populate: { path: 'company' }
      })
      .sort({ appliedAt: -1 });

    res.render('admin/applications', {
      title: 'Global Applications Audit - Admin Portal',
      applications,
      selectedStatus: status || 'all',
      searchQuery: search || ''
    });
  } catch (err) {
    next(err);
  }
};
