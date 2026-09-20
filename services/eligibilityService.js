const RecruiterProfile = require('../models/RecruiterProfile');
const Application = require('../models/Application');
const PlacementRecord = require('../models/PlacementRecord');

/**
 * Reusable Automatic Student Eligibility Engine
 * Evaluates 9 distinct criteria for student placement drive applications.
 */
const evaluateEligibility = async (studentProfile, drive, recruiterProfile = null) => {
  const result = {
    isEligible: false,
    reasons: [],
    failedRules: [],
    passedRules: []
  };

  // Rule 1: Profile Completeness
  if (
    !studentProfile ||
    !studentProfile.fullName ||
    !studentProfile.branch ||
    !studentProfile.collegeId ||
    studentProfile.cgpa === undefined ||
    studentProfile.cgpa === null ||
    !studentProfile.resumeLink ||
    !studentProfile.resumeLink.trim()
  ) {
    result.failedRules.push('PROFILE_COMPLETENESS');
    result.reasons.push('Please complete your student profile (including roll number, branch, CGPA, and resume link) before applying.');
  } else {
    result.passedRules.push('PROFILE_COMPLETENESS');
  }

  // Rule 2: Drive Status
  if (!drive || drive.status !== 'published') {
    result.failedRules.push('DRIVE_STATUS');
    result.reasons.push(`This drive is currently not active for student applications (Status: ${drive ? drive.status : 'Unknown'}).`);
  } else {
    result.passedRules.push('DRIVE_STATUS');
  }

  // Rule 3: Application Deadline
  if (drive && drive.lastDate) {
    const deadline = new Date(drive.lastDate);
    // Set end of deadline day for fair grace period
    deadline.setHours(23, 59, 59, 999);
    if (new Date() > deadline) {
      result.failedRules.push('APPLICATION_DEADLINE');
      result.reasons.push('The application deadline for this drive has passed.');
    } else {
      result.passedRules.push('APPLICATION_DEADLINE');
    }
  }

  // Rule 4: Recruiter Verification Status
  let targetRecruiter = recruiterProfile;
  if (!targetRecruiter && drive && drive.createdBy) {
    targetRecruiter = await RecruiterProfile.findOne({ user: drive.createdBy });
  }
  if (targetRecruiter && targetRecruiter.verified === false) {
    result.failedRules.push('RECRUITER_VERIFICATION');
    result.reasons.push('This drive is pending TPO verification of the recruiting partner.');
  } else {
    result.passedRules.push('RECRUITER_VERIFICATION');
  }

  // Evaluate student-specific rules only if profile exists
  if (studentProfile && drive) {
    // Rule 5: Branch Eligibility
    if (drive.eligibleBranches && drive.eligibleBranches.length > 0) {
      const studentBranch = (studentProfile.branch || '').trim().toLowerCase();
      const isBranchMatched = drive.eligibleBranches.some(b => {
        const norm = b.trim().toLowerCase();
        return norm === studentBranch || norm === 'all';
      });

      if (!isBranchMatched) {
        result.failedRules.push('BRANCH_ELIGIBILITY');
        result.reasons.push(`Your branch '${studentProfile.branch}' is not listed in eligible branches [${drive.eligibleBranches.join(', ')}].`);
      } else {
        result.passedRules.push('BRANCH_ELIGIBILITY');
      }
    }

    // Rule 6: Minimum CGPA Cutoff
    if (drive.minimumCGPA !== undefined && drive.minimumCGPA > 0) {
      const studentCgpa = studentProfile.cgpa || 0.0;
      if (studentCgpa < drive.minimumCGPA) {
        result.failedRules.push('MINIMUM_CGPA');
        result.reasons.push(`Your CGPA (${studentCgpa.toFixed(2)}) is below the required minimum cutoff (${drive.minimumCGPA.toFixed(2)}).`);
      } else {
        result.passedRules.push('MINIMUM_CGPA');
      }
    }

    // Rule 7: Target Graduation Year
    if (drive.graduationYears && drive.graduationYears.length > 0) {
      if (!drive.graduationYears.includes(studentProfile.graduationYear)) {
        result.failedRules.push('GRADUATION_YEAR');
        result.reasons.push(`Your graduation year (${studentProfile.graduationYear}) is not in target years [${drive.graduationYears.join(', ')}].`);
      } else {
        result.passedRules.push('GRADUATION_YEAR');
      }
    }

    // Rule 8: Required Skills Match (Case-Insensitive Exact Skill String Matching)
    if (drive.requiredSkills && drive.requiredSkills.length > 0) {
      const studentSkills = (studentProfile.skills || []).map(s => s.trim().toLowerCase());
      const missingSkills = [];

      drive.requiredSkills.forEach(reqSkill => {
        const targetSkill = reqSkill.trim().toLowerCase();
        if (targetSkill && !studentSkills.includes(targetSkill)) {
          missingSkills.push(reqSkill.trim());
        }
      });

      if (missingSkills.length > 0) {
        result.failedRules.push('REQUIRED_SKILLS');
        result.reasons.push(`Missing required skills: [${missingSkills.join(', ')}]. Please update your profile skills.`);
      } else {
        result.passedRules.push('REQUIRED_SKILLS');
      }
    }

    // Rule 9: College Placement Policy Restriction (One-Student-One-Job Policy)
    if (drive.driveType === 'placement') {
      const isExempt = studentProfile.isPolicyExempt === true;

      if (!isExempt) {
        // Check if student has already secured a full-time placement
        let isAlreadyPlaced = studentProfile.isPlaced === true;

        if (!isAlreadyPlaced) {
          // Double-check Applications with status 'selected' for placement drives
          const existingSelection = await Application.findOne({
            student: studentProfile.user,
            status: 'selected'
          }).populate('drive');

          if (existingSelection && existingSelection.drive && existingSelection.drive.driveType === 'placement') {
            isAlreadyPlaced = true;
          }
        }

        if (!isAlreadyPlaced) {
          // Double-check PlacementRecord
          const existingPlacementRecord = await PlacementRecord.findOne({
            student: studentProfile.user,
            placementType: { $in: ['full-time', 'internship-to-full-time'] },
            status: { $ne: 'withdrawn' }
          });

          if (existingPlacementRecord) {
            isAlreadyPlaced = true;
          }
        }

        if (isAlreadyPlaced) {
          result.failedRules.push('PLACEMENT_POLICY_RESTRICTION');
          result.reasons.push('You cannot apply to another placement drive because you have already been selected for a full-time placement (College One-Student-One-Job Policy).');
        } else {
          result.passedRules.push('PLACEMENT_POLICY_RESTRICTION');
        }
      } else {
        result.passedRules.push('PLACEMENT_POLICY_RESTRICTION');
      }
    } else {
      // Internship drive applications are permitted per college policy
      result.passedRules.push('PLACEMENT_POLICY_RESTRICTION');
    }
  }

  result.isEligible = result.failedRules.length === 0;
  return result;
};

module.exports = {
  evaluateEligibility
};
