const mongoose = require('mongoose');
const RecruiterProfile = require('../models/RecruiterProfile');
const StudentProfile = require('../models/StudentProfile');
const Company = require('../models/Company');
const User = require('../models/User');
const Drive = require('../models/Drive');
const Application = require('../models/Application');
const PlacementRecord = require('../models/PlacementRecord');
const eligibilityService = require('../services/eligibilityService');
const inMemoryStore = require('../config/inMemoryStore');

const isDbConnected = () => mongoose.connection.readyState === 1;

// Render Admin Dashboard Overview with Master Aggregation Statistics
exports.getDashboard = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.render('admin/dashboard', {
        title: 'Admin & TPO Dashboard - Campus Placement System',
        stats: {
          totalStudents: inMemoryStore.users.filter(u => u.role === 'student').length,
          totalRecruiters: inMemoryStore.users.filter(u => u.role === 'recruiter').length,
          pendingRecruiters: inMemoryStore.recruiterProfiles.filter(r => !r.verified).length,
          verifiedRecruiters: inMemoryStore.recruiterProfiles.filter(r => r.verified).length,
          totalCompanies: inMemoryStore.companies.length,
          totalDrives: inMemoryStore.drives.length,
          activeDrives: inMemoryStore.drives.filter(d => d.status === 'Active').length,
          placementDrives: inMemoryStore.drives.length,
          internshipDrives: 0,
          totalApplications: inMemoryStore.applications.length,
          placedStudentsCount: inMemoryStore.placements.length,
          unplacedStudentsCount: inMemoryStore.users.filter(u => u.role === 'student').length
        },
        aggregations: {
          branchPlacements: [],
          companyPlacements: [],
          applicationStatus: [],
          driveApplications: []
        }
      });
    }
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalRecruiters = await User.countDocuments({ role: 'recruiter' });
    const pendingRecruiters = await RecruiterProfile.countDocuments({ verified: false });
    const verifiedRecruiters = await RecruiterProfile.countDocuments({ verified: true });
    const totalCompanies = await Company.countDocuments();
    const totalDrives = await Drive.countDocuments();
    const activeDrives = await Drive.countDocuments({ status: 'published' });
    const placementDrives = await Drive.countDocuments({ driveType: 'placement' });
    const internshipDrives = await Drive.countDocuments({ driveType: 'internship' });
    const totalApplications = await Application.countDocuments();
    
    // Placed vs Unplaced Students Calculation
    const placedStudentsCount = await StudentProfile.countDocuments({ isPlaced: true });
    const totalPlacementRecords = await PlacementRecord.countDocuments({ status: { $ne: 'withdrawn' } });
    const actualPlacedCount = Math.max(placedStudentsCount, totalPlacementRecords);
    const unplacedStudentsCount = Math.max(0, totalStudents - actualPlacedCount);

    // MongoDB Aggregation Pipeline 1: Branch-Wise Placement Count
    const branchPlacementsAgg = await StudentProfile.aggregate([
      { $match: { isPlaced: true } },
      { $group: { _id: '$branch', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // MongoDB Aggregation Pipeline 2: Company-Wise Placement Count
    const companyPlacementsAgg = await PlacementRecord.aggregate([
      { $match: { status: { $ne: 'withdrawn' } } },
      { $lookup: { from: 'companies', localField: 'company', foreignField: '_id', as: 'companyDoc' } },
      { $unwind: { path: '$companyDoc', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$companyDoc.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // MongoDB Aggregation Pipeline 3: Application Status Distribution
    const applicationStatusAgg = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // MongoDB Aggregation Pipeline 4: Drive-Wise Application Count
    const driveApplicationsAgg = await Application.aggregate([
      { $lookup: { from: 'drives', localField: 'drive', foreignField: '_id', as: 'driveDoc' } },
      { $unwind: { path: '$driveDoc', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$driveDoc.title', count: { $sum: 1 }, driveType: { $first: '$driveDoc.driveType' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.render('admin/dashboard', {
      title: 'Admin & TPO Dashboard - Campus Placement System',
      stats: {
        totalStudents,
        totalRecruiters,
        pendingRecruiters,
        verifiedRecruiters,
        totalCompanies,
        totalDrives,
        activeDrives,
        placementDrives,
        internshipDrives,
        totalApplications,
        placedStudentsCount: actualPlacedCount,
        unplacedStudentsCount
      },
      aggregations: {
        branchPlacements: branchPlacementsAgg,
        companyPlacements: companyPlacementsAgg,
        applicationStatus: applicationStatusAgg,
        driveApplications: driveApplicationsAgg
      }
    });
  } catch (err) {
    next(err);
  }
};

// Render All Recruiters & Verification Management Page
exports.getRecruiters = async (req, res, next) => {
  try {
    const statusFilter = req.query.status || 'all';

    if (!isDbConnected()) {
      const recruiters = inMemoryStore.recruiterProfiles.map(rp => ({
        ...rp,
        user: inMemoryStore.findUserById(rp.user) || { name: 'Recruiter', email: 'recruiter@techcorp.com', isActive: true },
        company: inMemoryStore.companies.find(c => c._id === rp.company) || { name: 'TechCorp Global' }
      }));

      return res.render('admin/recruiters', {
        title: 'Recruiter Verification & Management',
        recruiters,
        statusFilter,
        success: req.query.success || null,
        error: req.query.error || null
      });
    }

    let queryFilter = {};
    if (statusFilter === 'pending') {
      queryFilter = { verified: false };
    } else if (statusFilter === 'verified') {
      queryFilter = { verified: true };
    }

    const recruiters = await RecruiterProfile.find(queryFilter)
      .populate('user')
      .populate('company')
      .sort({ createdAt: -1 });

    res.render('admin/recruiters', {
      title: 'Recruiter Verification & Management',
      recruiters,
      statusFilter,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

// Verify Recruiter Action
exports.verifyRecruiter = async (req, res, next) => {
  try {
    const recruiterProfileId = req.params.id;

    if (!isDbConnected()) {
      const profile = inMemoryStore.recruiterProfiles.find(r => r._id === recruiterProfileId);
      if (profile) profile.verified = true;
      return res.redirect('/admin/recruiters?success=Recruiter+verified+successfully');
    }

    const profile = await RecruiterProfile.findById(recruiterProfileId);

    if (!profile) {
      return res.redirect('/admin/recruiters?error=Recruiter+profile+not+found');
    }

    profile.verified = true;
    await profile.save();

    return res.redirect('/admin/recruiters?success=Recruiter+verified+successfully');
  } catch (err) {
    next(err);
  }
};

// Reject / Revoke Recruiter Verification Action
exports.rejectRecruiter = async (req, res, next) => {
  try {
    const recruiterProfileId = req.params.id;

    if (!isDbConnected()) {
      const profile = inMemoryStore.recruiterProfiles.find(r => r._id === recruiterProfileId);
      if (profile) profile.verified = false;
      return res.redirect('/admin/recruiters?success=Recruiter+verification+rejected/revoked');
    }

    const profile = await RecruiterProfile.findById(recruiterProfileId);

    if (!profile) {
      return res.redirect('/admin/recruiters?error=Recruiter+profile+not+found');
    }

    profile.verified = false;
    await profile.save();

    return res.redirect('/admin/recruiters?success=Recruiter+verification+rejected/revoked');
  } catch (err) {
    next(err);
  }
};

// Toggle User Active/Inactive Status
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const userId = req.params.id;

    if (!isDbConnected()) {
      const user = inMemoryStore.findUserById(userId);
      if (user) user.isActive = !user.isActive;
      return res.redirect('/admin/recruiters?success=User+account+updated+successfully');
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect('/admin/recruiters?error=User+not+found');
    }

    user.isActive = !user.isActive;
    await user.save();

    const statusMsg = user.isActive ? 'activated' : 'deactivated';
    return res.redirect(`/admin/recruiters?success=User+account+${statusMsg}+successfully`);
  } catch (err) {
    next(err);
  }
};

// --- PART 11 NEW ADMIN CONTROLLER METHODS ---

// View All Placement & Internship Drives (with filtering & status controls)
exports.getDrives = async (req, res, next) => {
  try {
    const { driveType, status, company, search } = req.query;

    if (!isDbConnected()) {
      const drives = inMemoryStore.getAllDrives().map(d => ({
        ...d,
        company: { name: d.companyName || 'TechCorp Global' },
        createdBy: { name: 'Recruiter Admin', email: 'recruiter@techcorp.com' }
      }));

      return res.render('admin/drives', {
        title: 'Drive Oversight & Management',
        drives,
        companies: inMemoryStore.companies,
        filters: { driveType: driveType || '', status: status || '', company: company || '', search: search || '' },
        success: req.query.success || null,
        error: req.query.error || null
      });
    }
    const query = {};

    if (driveType) {
      query.driveType = driveType;
    }
    if (status) {
      query.status = status;
    }
    if (company) {
      query.company = company;
    }
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { role: searchRegex }];
    }

    const drives = await Drive.find(query)
      .populate('company')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    const companies = await Company.find().sort({ companyName: 1 });

    res.render('admin/drives', {
      title: 'Drive Oversight & Management',
      drives,
      companies,
      filters: { driveType: driveType || '', status: status || '', company: company || '', search: search || '' },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

// Update Drive Status (Close / Cancel / Publish)
exports.updateDriveStatus = async (req, res, next) => {
  try {
    const driveId = req.params.id;
    const { status } = req.body;

    const allowedStatuses = ['draft', 'published', 'closed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.redirect('/admin/drives?error=Invalid+drive+status');
    }

    const drive = await Drive.findById(driveId);
    if (!drive) {
      return res.redirect('/admin/drives?error=Drive+not+found');
    }

    drive.status = status;
    await drive.save();

    return res.redirect(`/admin/drives?success=Drive+status+updated+to+${status}`);
  } catch (err) {
    next(err);
  }
};

// Comprehensive Applications Audit Table (Advanced Multi-Parameter Filter)
exports.getApplications = async (req, res, next) => {
  try {
    const { company, drive, driveType, branch, graduationYear, status, minCgpa, maxCgpa, startDate, endDate, search } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.appliedAt = {};
      if (startDate) query.appliedAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.appliedAt.$lte = end;
      }
    }

    let rawApplications = await Application.find(query)
      .populate({
        path: 'drive',
        populate: { path: 'company' }
      })
      .populate('student')
      .sort({ appliedAt: -1 });

    // Extract student IDs to fetch StudentProfile records in bulk
    const studentUserIds = rawApplications.map(app => app.student ? app.student._id : null).filter(Boolean);
    const profiles = await StudentProfile.find({ user: { $in: studentUserIds } });
    const profileMap = new Map();
    profiles.forEach(p => profileMap.set(p.user.toString(), p));

    // Filter in-memory for populated drive/student fields
    let applications = rawApplications.filter(app => {
      if (!app.drive || !app.student) return false;

      const studentProfile = profileMap.get(app.student._id.toString());

      // Company Filter
      if (company && app.drive.company && app.drive.company._id.toString() !== company) {
        return false;
      }

      // Drive Filter
      if (drive && app.drive._id.toString() !== drive) {
        return false;
      }

      // Drive Type Filter
      if (driveType && app.drive.driveType !== driveType) {
        return false;
      }

      // Branch Filter
      if (branch) {
        const sBranch = studentProfile ? (studentProfile.branch || '') : '';
        if (sBranch.toLowerCase() !== branch.toLowerCase()) return false;
      }

      // Graduation Year Filter
      if (graduationYear) {
        const sGrad = studentProfile ? studentProfile.graduationYear : null;
        if (Number(sGrad) !== Number(graduationYear)) return false;
      }

      // Min CGPA Filter
      if (minCgpa !== undefined && minCgpa !== '') {
        const sCgpa = studentProfile ? (studentProfile.cgpa || 0) : 0;
        if (sCgpa < Number(minCgpa)) return false;
      }

      // Max CGPA Filter
      if (maxCgpa !== undefined && maxCgpa !== '') {
        const sCgpa = studentProfile ? (studentProfile.cgpa || 0) : 0;
        if (sCgpa > Number(maxCgpa)) return false;
      }

      // Search Query (Student Name, Email, Roll Number)
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        const nameMatch = (app.student.name || '').toLowerCase().includes(term);
        const emailMatch = (app.student.email || '').toLowerCase().includes(term);
        const rollMatch = studentProfile ? (studentProfile.collegeId || '').toLowerCase().includes(term) : false;
        if (!nameMatch && !emailMatch && !rollMatch) return false;
      }

      return true;
    });

    // Attach student profile to application objects for view rendering
    applications = applications.map(app => {
      const appObj = app.toObject();
      appObj.studentProfile = profileMap.get(app.student._id.toString()) || null;
      return appObj;
    });

    const companies = await Company.find().sort({ companyName: 1 });
    const allDrives = await Drive.find().select('_id title role').sort({ createdAt: -1 });

    res.render('admin/applications', {
      title: 'Global Applications Audit & Oversight',
      applications,
      companies,
      drives: allDrives,
      filters: {
        company: company || '',
        drive: drive || '',
        driveType: driveType || '',
        branch: branch || '',
        graduationYear: graduationYear || '',
        status: status || '',
        minCgpa: minCgpa || '',
        maxCgpa: maxCgpa || '',
        startDate: startDate || '',
        endDate: endDate || '',
        search: search || ''
      },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

// Detailed Application Inspection Dossier Page
exports.getApplicationDetail = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const application = await Application.findById(applicationId)
      .populate({
        path: 'drive',
        populate: { path: 'company' }
      })
      .populate('student')
      .populate('adminOverriddenBy', 'name email');

    if (!application) {
      return res.status(404).render('error', {
        title: 'Application Not Found',
        message: 'The requested application record could not be found.'
      });
    }

    const studentProfile = await StudentProfile.findOne({ user: application.student._id });
    
    // Evaluate backend eligibility breakdown live
    const eligibilityResult = await eligibilityService.evaluateEligibility(studentProfile, application.drive);

    res.render('admin/application-detail', {
      title: `Application Dossier - ${application.student.name}`,
      application,
      studentProfile,
      eligibilityResult,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

// Admin Status Override Action with Audit Logging & Placement Record Auto-Creation
exports.overrideApplicationStatus = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const { status, notes, rejectionReason, interviewDate } = req.body;

    const allowedStatuses = ['applied', 'shortlisted', 'interviewed', 'selected', 'rejected', 'withdrawn'];
    if (!allowedStatuses.includes(status)) {
      return res.redirect(`/admin/applications/${applicationId}?error=Invalid+status+specified`);
    }

    const application = await Application.findById(applicationId).populate('drive');
    if (!application) {
      return res.redirect('/admin/applications?error=Application+not+found');
    }

    application.status = status;
    if (notes) application.screeningNotes = notes;
    if (rejectionReason) application.rejectionReason = rejectionReason;
    if (interviewDate) application.interviewDate = new Date(interviewDate);

    // Record Admin Audit Trail
    application.adminOverrideReason = notes || `Admin status override to ${status}`;
    application.adminOverriddenAt = new Date();
    application.adminOverriddenBy = req.session.user._id;

    // Handle Selection State & Placement Record Creation
    if (status === 'selected') {
      application.selectedAt = application.selectedAt || new Date();

      // Upsert PlacementRecord cleanly
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
          placementType: application.drive.driveType === 'internship' ? 'internship' : 'full-time',
          selectedAt: new Date(),
          status: 'selected'
        },
        { upsert: true, new: true }
      );

      // If full-time placement, update StudentProfile
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

    return res.redirect(`/admin/applications/${applicationId}?success=Application+status+overridden+to+${status}+successfully`);
  } catch (err) {
    next(err);
  }
};

// Toggle Student Placement Policy Exemption (Admin Override)
exports.toggleStudentPolicyExemption = async (req, res, next) => {
  try {
    const studentUserId = req.params.id;
    const { exemptionReason } = req.body;

    const profile = await StudentProfile.findOne({ user: studentUserId });
    if (!profile) {
      return res.redirect('/admin/applications?error=Student+profile+not+found');
    }

    profile.isPolicyExempt = !profile.isPolicyExempt;
    if (profile.isPolicyExempt) {
      profile.policyExemptionReason = exemptionReason ? exemptionReason.trim() : 'Admin granted policy exemption';
      profile.policyExemptedBy = req.session.user._id;
    } else {
      profile.policyExemptionReason = undefined;
      profile.policyExemptedBy = undefined;
    }

    await profile.save();

    const statusMsg = profile.isPolicyExempt ? 'granted' : 'revoked';
    return res.redirect(`/admin/applications?success=Placement+policy+exemption+${statusMsg}+successfully`);
  } catch (err) {
    next(err);
  }
};

// Monitor Placement Records
exports.getPlacements = async (req, res, next) => {
  try {
    const placements = await PlacementRecord.find()
      .populate('student')
      .populate('company')
      .populate('drive')
      .sort({ selectedAt: -1 });

    const totalPlaced = placements.length;
    const fullTimePlacements = placements.filter(p => p.placementType === 'full-time' || p.placementType === 'internship-to-full-time');
    const avgPackage = fullTimePlacements.length > 0
      ? (fullTimePlacements.reduce((sum, p) => sum + (p.package || 0), 0) / fullTimePlacements.length).toFixed(2)
      : 0;

    const companies = await Company.find().sort({ companyName: 1 });
    const drives = await Drive.find().sort({ title: 1 });
    const students = await User.find({ role: 'student' }).sort({ name: 1 });

    res.render('admin/placements', {
      title: 'Placement Records & Selected Students Monitoring',
      placements,
      companies,
      drives,
      students,
      stats: {
        totalPlaced,
        fullTimeCount: fullTimePlacements.length,
        internshipCount: totalPlaced - fullTimePlacements.length,
        avgPackage
      },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

// Manual Placement Record Entry / Creation
exports.createPlacementRecord = async (req, res, next) => {
  try {
    const { studentId, companyId, driveId, role, packageVal, placementType } = req.body;

    if (!studentId || !companyId || !driveId || !role || !packageVal) {
      return res.redirect('/admin/placements?error=All+placement+record+fields+are+required');
    }

    await PlacementRecord.create({
      student: studentId,
      company: companyId,
      drive: driveId,
      role: role.trim(),
      package: Number(packageVal),
      placementType: placementType || 'full-time',
      selectedAt: new Date(),
      status: 'selected'
    });

    return res.redirect('/admin/placements?success=Placement+record+created+successfully');
  } catch (err) {
    next(err);
  }
};

