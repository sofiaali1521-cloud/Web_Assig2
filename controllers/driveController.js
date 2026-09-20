const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Drive = require('../models/Drive');
const RecruiterProfile = require('../models/RecruiterProfile');
const Company = require('../models/Company');
const StudentProfile = require('../models/StudentProfile');
const { evaluateEligibility } = require('../services/eligibilityService');
const inMemoryStore = require('../config/inMemoryStore');

const isDbConnected = () => mongoose.connection.readyState === 1;

// 1. Student View: Browse Published Drives with Multi-Filter, Search & Sorting
exports.getStudentDrives = async (req, res, next) => {
  try {
    const { driveType, branch, workMode, search, sort, eligibility } = req.query;

    if (!isDbConnected()) {
      const studentProfile = inMemoryStore.getStudentProfile(req.session.user ? req.session.user._id : 'demo');
      const processedDrives = inMemoryStore.getAllDrives().map(d => ({
        ...d,
        company: { name: d.companyName || 'TechCorp Global' },
        lastDate: d.deadline || new Date(Date.now() + 14 * 86400000),
        eligibilityInfo: { isEligible: true, reasons: [], failedRules: [], passedRules: [] },
        isExpired: false
      }));

      return res.render('drives/index', {
        title: 'Available Placement & Internship Drives',
        drives: processedDrives,
        studentProfile,
        selectedType: driveType || 'all',
        selectedBranch: branch || 'all',
        selectedWorkMode: workMode || 'all',
        selectedSort: sort || 'latest',
        selectedEligibility: eligibility || 'all',
        searchQuery: search || ''
      });
    }
    
    let studentProfile = null;
    if (req.session.user && req.session.user.role === 'student') {
      studentProfile = await StudentProfile.findOne({ user: req.session.user._id });
    }

    let filter = { status: 'published' };

    // Filter: Drive Type
    if (driveType && driveType !== 'all') {
      filter.driveType = driveType;
    }

    // Filter: Branch
    if (branch && branch !== 'all') {
      filter.eligibleBranches = { $in: [new RegExp(`^${branch}$`, 'i'), 'all', 'All'] };
    }

    // Filter: Work Mode
    if (workMode && workMode !== 'all') {
      filter.workMode = workMode;
    }

    // Search Query (Company name, Role, Title, Required Skill, Location)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      const matchingCompanies = await Company.find({ name: searchRegex }).select('_id');
      const companyIds = matchingCompanies.map(c => c._id);

      filter.$or = [
        { title: searchRegex },
        { role: searchRegex },
        { location: searchRegex },
        { requiredSkills: searchRegex },
        { company: { $in: companyIds } }
      ];
    }

    // Sorting Configuration
    let sortOptions = { createdAt: -1 }; // Default: Latest drives
    if (sort === 'deadline') {
      sortOptions = { lastDate: 1 };
    } else if (sort === 'package') {
      sortOptions = { package: -1 };
    } else if (sort === 'stipend') {
      sortOptions = { stipend: -1 };
    }

    let drives = await Drive.find(filter)
      .populate('company')
      .sort(sortOptions);

    if (sort === 'company') {
      drives.sort((a, b) => {
        const nameA = a.company ? a.company.name.toLowerCase() : '';
        const nameB = b.company ? b.company.name.toLowerCase() : '';
        return nameA.localeCompare(nameB);
      });
    }

    // Evaluate eligibility per drive using eligibilityService
    const now = new Date();
    let processedDrives = await Promise.all(drives.map(async d => {
      const eligibilityInfo = await evaluateEligibility(studentProfile, d);
      const isExpired = new Date(d.lastDate) < now;
      return {
        ...d.toObject(),
        eligibilityInfo,
        isExpired
      };
    }));

    // Filter: Eligible Only
    if (eligibility === 'eligible') {
      processedDrives = processedDrives.filter(d => d.eligibilityInfo.isEligible && !d.isExpired);
    }

    res.render('drives/index', {
      title: 'Available Placement & Internship Drives',
      drives: processedDrives,
      studentProfile,
      selectedType: driveType || 'all',
      selectedBranch: branch || 'all',
      selectedWorkMode: workMode || 'all',
      selectedSort: sort || 'latest',
      selectedEligibility: eligibility || 'all',
      searchQuery: search || ''
    });
  } catch (err) {
    next(err);
  }
};

// 2. View Drive Detail
exports.getDriveDetail = async (req, res, next) => {
  try {
    const driveId = req.params.id;

    if (!isDbConnected()) {
      const driveObj = inMemoryStore.getDriveById(driveId) || inMemoryStore.drives[0];
      const drive = {
        ...driveObj,
        company: { name: driveObj.companyName || 'TechCorp Global' },
        createdBy: { name: 'Recruiter Admin', email: 'recruiter@techcorp.com' },
        lastDate: driveObj.deadline || new Date(Date.now() + 14 * 86400000)
      };

      const studentProfile = inMemoryStore.getStudentProfile(req.session.user ? req.session.user._id : 'demo');
      const eligibilityInfo = { isEligible: true, reasons: [], failedRules: [], passedRules: [] };

      return res.render('drives/detail', {
        title: `${drive.title} - ${drive.company ? drive.company.name : 'Drive'}`,
        drive,
        studentProfile,
        eligibilityInfo,
        isExpired: false
      });
    }

    const drive = await Drive.findById(driveId)
      .populate('company')
      .populate('createdBy', 'name email phone');

    if (!drive) {
      return res.status(404).render('errors/404', { title: 'Drive Not Found' });
    }

    // Hide non-published drives from normal students
    if (req.session.user.role === 'student' && drive.status !== 'published') {
      return res.status(403).render('errors/500', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'This drive opportunity is currently not available or is under draft review.',
        error: {}
      });
    }

    let studentProfile = null;
    let eligibilityInfo = { isEligible: true, reasons: [], failedRules: [], passedRules: [] };

    if (req.session.user.role === 'student') {
      studentProfile = await StudentProfile.findOne({ user: req.session.user._id });
      eligibilityInfo = await evaluateEligibility(studentProfile, drive);
    }

    const isExpired = new Date(drive.lastDate) < new Date();

    res.render('drives/detail', {
      title: `${drive.title} - ${drive.company ? drive.company.name : 'Drive'}`,
      drive,
      studentProfile,
      eligibilityInfo,
      isExpired
    });
  } catch (err) {
    next(err);
  }
};

// 3. Recruiter View: Manage Recruiter's Drives
exports.getRecruiterDrives = async (req, res, next) => {
  try {
    const recruiterUserId = req.session.user._id;

    if (!isDbConnected()) {
      const recruiterProf = inMemoryStore.getRecruiterProfile(recruiterUserId);
      const drives = inMemoryStore.getAllDrives().map(d => ({
        ...d,
        company: { name: d.companyName || 'TechCorp Global' }
      }));

      return res.render('recruiter/drives', {
        title: 'My Posted Drives',
        drives,
        recruiterProf,
        success: req.query.success || null,
        error: req.query.error || null
      });
    }

    const recruiterProf = await RecruiterProfile.findOne({ user: recruiterUserId });

    const drives = await Drive.find({ createdBy: recruiterUserId })
      .populate('company')
      .sort({ createdAt: -1 });

    res.render('recruiter/drives', {
      title: 'My Posted Drives',
      drives,
      recruiterProf,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

// 4. Render Create Drive Form
exports.getCreateDrive = async (req, res, next) => {
  try {
    const recruiterUserId = req.session.user._id;

    if (!isDbConnected()) {
      return res.render('recruiter/create-drive', {
        title: 'Post New Placement / Internship Drive',
        companies: inMemoryStore.companies,
        companyId: inMemoryStore.companies[0]._id,
        formData: {},
        errors: []
      });
    }

    let companyId = null;

    if (req.session.user.role === 'recruiter') {
      let recruiterProf = await RecruiterProfile.findOne({ user: recruiterUserId });
      if (!recruiterProf) {
        return res.redirect('/recruiter/profile');
      }
      if (!recruiterProf.company) {
        let comp = await Company.findOne({ createdBy: recruiterUserId });
        if (!comp) {
          comp = new Company({
            name: req.session.user.name ? `${req.session.user.name}'s Company` : 'Hiring Company',
            createdBy: recruiterUserId
          });
          await comp.save();
        }
        recruiterProf.company = comp._id;
        await recruiterProf.save();
      }
      companyId = recruiterProf.company;
    }

    const companies = await Company.find().sort({ name: 1 });

    res.render('recruiter/create-drive', {
      title: 'Post New Placement / Internship Drive',
      companies,
      companyId,
      formData: {},
      errors: []
    });
  } catch (err) {
    next(err);
  }
};

// 5. Handle Create Drive Submission
exports.postCreateDrive = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const recruiterUserId = req.session.user._id;

    if (!isDbConnected()) {
      inMemoryStore.createDrive(req.body, recruiterUserId);
      const redirectPath = req.session.user.role === 'admin' ? '/admin/drives' : '/drives/recruiter/manage';
      return res.redirect(`${redirectPath}?success=Drive+created+successfully`);
    }

    const {
      company,
      title,
      role,
      driveType,
      description,
      package: drivePackage,
      stipend,
      location,
      workMode,
      eligibleBranches,
      minimumCGPA,
      requiredSkills,
      graduationYears,
      lastDate,
      driveDate,
      totalOpenings,
      status
    } = req.body;

    let targetCompanyId = company;
    let isVerifiedRecruiter = true;

    if (req.session.user.role === 'recruiter') {
      let recruiterProf = await RecruiterProfile.findOne({ user: recruiterUserId });
      if (!recruiterProf) {
        return res.redirect('/recruiter/profile');
      }
      if (!recruiterProf.company) {
        let comp = await Company.findOne({ createdBy: recruiterUserId });
        if (!comp) {
          comp = new Company({
            name: req.session.user.name ? `${req.session.user.name}'s Company` : 'Hiring Company',
            createdBy: recruiterUserId
          });
          await comp.save();
        }
        recruiterProf.company = comp._id;
        await recruiterProf.save();
      }
      targetCompanyId = recruiterProf.company;
      isVerifiedRecruiter = recruiterProf.verified;
    }

    const requestedStatus = status || 'draft';
    if (requestedStatus === 'published' && !isVerifiedRecruiter) {
      const companies = await Company.find().sort({ name: 1 });
      return res.status(400).render('recruiter/create-drive', {
        title: 'Post New Placement / Internship Drive',
        companies,
        companyId: targetCompanyId,
        formData: req.body,
        errors: [{ msg: 'Unverified recruiters cannot publish drives. Please request TPO verification or save as Draft.' }]
      });
    }

    if (!errors.isEmpty()) {
      const companies = await Company.find().sort({ name: 1 });
      return res.status(400).render('recruiter/create-drive', {
        title: 'Post New Placement / Internship Drive',
        companies,
        companyId: targetCompanyId,
        formData: req.body,
        errors: errors.array()
      });
    }

    const parsedBranches = Array.isArray(eligibleBranches)
      ? eligibleBranches
      : typeof eligibleBranches === 'string' ? eligibleBranches.split(',').map(b => b.trim()).filter(b => b.length > 0) : ['CSE'];

    const parsedSkills = typeof requiredSkills === 'string'
      ? requiredSkills.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    const parsedGradYears = typeof graduationYears === 'string'
      ? graduationYears.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y))
      : [new Date().getFullYear()];

    const newDrive = new Drive({
      company: targetCompanyId,
      createdBy: recruiterUserId,
      title: title.trim(),
      role: role.trim(),
      driveType,
      description: description.trim(),
      package: drivePackage ? parseFloat(drivePackage) : 0,
      stipend: stipend ? parseFloat(stipend) : 0,
      location: location ? location.trim() : 'On-Campus',
      workMode: workMode || 'on-site',
      eligibleBranches: parsedBranches,
      minimumCGPA: minimumCGPA ? parseFloat(minimumCGPA) : 0.0,
      requiredSkills: parsedSkills,
      graduationYears: parsedGradYears,
      lastDate: new Date(lastDate),
      driveDate: driveDate ? new Date(driveDate) : null,
      totalOpenings: totalOpenings ? parseInt(totalOpenings) : 1,
      status: requestedStatus
    });

    await newDrive.save();

    const redirectPath = req.session.user.role === 'admin' ? '/admin/drives' : '/drives/recruiter/manage';
    return res.redirect(`${redirectPath}?success=Drive+created+successfully`);
  } catch (err) {
    next(err);
  }
};

// 6. Render Edit Drive Form
exports.getEditDrive = async (req, res, next) => {
  try {
    const driveId = req.params.id;

    if (!isDbConnected()) {
      const drive = inMemoryStore.getDriveById(driveId) || inMemoryStore.drives[0];
      return res.render('recruiter/edit-drive', {
        title: `Edit Drive - ${drive.title}`,
        drive,
        companies: inMemoryStore.companies,
        skillsString: Array.isArray(drive.requiredSkills) ? drive.requiredSkills.join(', ') : '',
        gradYearsString: Array.isArray(drive.graduationYears) ? drive.graduationYears.join(', ') : '',
        errors: []
      });
    }

    const drive = await Drive.findById(driveId);

    if (!drive) {
      return res.status(404).render('errors/404', { title: 'Drive Not Found' });
    }

    if (req.session.user.role === 'recruiter' && drive.createdBy.toString() !== req.session.user._id.toString()) {
      return res.status(403).render('errors/500', {
        title: 'Access Denied',
        statusCode: 403,
        message: 'You are not authorized to edit another recruiter\'s drive opportunity.',
        error: {}
      });
    }

    const companies = await Company.find().sort({ name: 1 });

    res.render('recruiter/edit-drive', {
      title: `Edit Drive - ${drive.title}`,
      drive,
      companies,
      skillsString: Array.isArray(drive.requiredSkills) ? drive.requiredSkills.join(', ') : '',
      gradYearsString: Array.isArray(drive.graduationYears) ? drive.graduationYears.join(', ') : '',
      errors: []
    });
  } catch (err) {
    next(err);
  }
};

// 7. Handle Edit Drive Submission
exports.postEditDrive = async (req, res, next) => {
  try {
    const driveId = req.params.id;

    if (!isDbConnected()) {
      const redirectPath = req.session.user.role === 'admin' ? '/admin/drives' : '/drives/recruiter/manage';
      return res.redirect(`${redirectPath}?success=Drive+updated+successfully`);
    }

    const errors = validationResult(req);
    const drive = await Drive.findById(driveId);

    if (!drive) {
      return res.status(404).render('errors/404', { title: 'Drive Not Found' });
    }

    if (req.session.user.role === 'recruiter' && drive.createdBy.toString() !== req.session.user._id.toString()) {
      return res.status(403).render('errors/500', { title: 'Access Denied', statusCode: 403, message: 'Unauthorized', error: {} });
    }

    const {
      title,
      role,
      driveType,
      description,
      package: drivePackage,
      stipend,
      location,
      workMode,
      eligibleBranches,
      minimumCGPA,
      requiredSkills,
      graduationYears,
      lastDate,
      driveDate,
      totalOpenings,
      status
    } = req.body;

    if (status === 'published' && req.session.user.role === 'recruiter') {
      const recruiterProf = await RecruiterProfile.findOne({ user: req.session.user._id });
      if (recruiterProf && !recruiterProf.verified) {
        const companies = await Company.find().sort({ name: 1 });
        return res.status(400).render('recruiter/edit-drive', {
          title: `Edit Drive - ${drive.title}`,
          drive: { ...drive.toObject(), ...req.body },
          companies,
          skillsString: requiredSkills || '',
          gradYearsString: graduationYears || '',
          errors: [{ msg: 'Unverified recruiters cannot publish drives. TPO verification is required.' }]
        });
      }
    }

    if (!errors.isEmpty()) {
      const companies = await Company.find().sort({ name: 1 });
      return res.status(400).render('recruiter/edit-drive', {
        title: `Edit Drive - ${drive.title}`,
        drive: { ...drive.toObject(), ...req.body },
        companies,
        skillsString: requiredSkills || '',
        gradYearsString: graduationYears || '',
        errors: errors.array()
      });
    }

    const parsedBranches = Array.isArray(eligibleBranches)
      ? eligibleBranches
      : typeof eligibleBranches === 'string' ? eligibleBranches.split(',').map(b => b.trim()).filter(b => b.length > 0) : drive.eligibleBranches;

    const parsedSkills = typeof requiredSkills === 'string'
      ? requiredSkills.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    const parsedGradYears = typeof graduationYears === 'string'
      ? graduationYears.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y))
      : drive.graduationYears;

    drive.title = title.trim();
    drive.role = role.trim();
    drive.driveType = driveType;
    drive.description = description.trim();
    drive.package = drivePackage ? parseFloat(drivePackage) : 0;
    drive.stipend = stipend ? parseFloat(stipend) : 0;
    drive.location = location ? location.trim() : 'On-Campus';
    drive.workMode = workMode || 'on-site';
    drive.eligibleBranches = parsedBranches;
    drive.minimumCGPA = minimumCGPA ? parseFloat(minimumCGPA) : 0.0;
    drive.requiredSkills = parsedSkills;
    drive.graduationYears = parsedGradYears;
    drive.lastDate = new Date(lastDate);
    if (driveDate) drive.driveDate = new Date(driveDate);
    drive.totalOpenings = totalOpenings ? parseInt(totalOpenings) : 1;
    drive.status = status || drive.status;

    await drive.save();

    const redirectPath = req.session.user.role === 'admin' ? '/admin/drives' : '/drives/recruiter/manage';
    return res.redirect(`${redirectPath}?success=Drive+updated+successfully`);
  } catch (err) {
    next(err);
  }
};

// 8. Update Drive Status
exports.updateDriveStatus = async (req, res, next) => {
  try {
    const driveId = req.params.id;
    const { status } = req.body;

    if (!isDbConnected()) {
      const drive = inMemoryStore.getDriveById(driveId);
      if (drive) drive.status = status;
      const redirectPath = req.session.user.role === 'admin' ? '/admin/drives' : '/drives/recruiter/manage';
      return res.redirect(`${redirectPath}?success=Drive+status+updated+to+${status}`);
    }

    const drive = await Drive.findById(driveId);

    if (!drive) {
      return res.status(404).send('Drive not found');
    }

    if (req.session.user.role === 'recruiter') {
      if (drive.createdBy.toString() !== req.session.user._id.toString()) {
        return res.status(403).send('Unauthorized');
      }
      if (status === 'published') {
        const recruiterProf = await RecruiterProfile.findOne({ user: req.session.user._id });
        if (recruiterProf && !recruiterProf.verified) {
          return res.redirect('/drives/recruiter/manage?error=Unverified+recruiters+cannot+publish+drives');
        }
      }
    }

    drive.status = status;
    await drive.save();

    const redirectPath = req.session.user.role === 'admin' ? '/admin/drives' : '/drives/recruiter/manage';
    return res.redirect(`${redirectPath}?success=Drive+status+updated+to+${status}`);
  } catch (err) {
    next(err);
  }
};

// 9. Admin View: All Drives Overview
exports.getAdminDrives = async (req, res, next) => {
  try {
    const { status } = req.query;

    if (!isDbConnected()) {
      const drives = inMemoryStore.getAllDrives().map(d => ({
        ...d,
        company: { name: d.companyName || 'TechCorp Global' },
        createdBy: { name: 'Recruiter Admin', email: 'recruiter@techcorp.com' }
      }));

      return res.render('admin/drives', {
        title: 'Placement Drive Management - Admin Control',
        drives,
        selectedStatus: status || 'all',
        success: req.query.success || null,
        error: req.query.error || null
      });
    }

    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const drives = await Drive.find(filter)
      .populate('company')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.render('admin/drives', {
      title: 'Placement Drive Management - Admin Control',
      drives,
      selectedStatus: status || 'all',
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};
