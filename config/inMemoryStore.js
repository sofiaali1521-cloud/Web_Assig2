const bcrypt = require('bcryptjs');

// Pre-hashed passwords for instant sync checks in memory fallback
const hashedPasswordAdmin = bcrypt.hashSync('Admin@123456', 10);
const hashedPasswordUser = bcrypt.hashSync('Student@123', 10);
const hashedPasswordRecruiter = bcrypt.hashSync('Recruiter@123', 10);

class InMemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = [
      {
        _id: 'admin_demo_id',
        name: 'Head TPO Admin',
        email: 'admin@placement.edu',
        password: hashedPasswordAdmin,
        role: 'admin',
        phone: '+91 9876543210',
        isActive: true
      },
      {
        _id: 'student_demo_id',
        name: 'Alex Johnson',
        email: 'user@college.edu',
        password: hashedPasswordUser,
        role: 'student',
        phone: '+91 9876500001',
        isActive: true
      },
      {
        _id: 'recruiter_demo_id',
        name: 'Jane Smith',
        email: 'recruiter@techcorp.com',
        password: hashedPasswordRecruiter,
        role: 'recruiter',
        phone: '+1 555-019-2834',
        isActive: true
      }
    ];

    this.companies = [
      {
        _id: 'comp_1',
        name: 'TechCorp Global',
        industry: 'Software & Technology',
        website: 'https://techcorp.example.com',
        description: 'Leading global cloud & software engineering firm.'
      },
      {
        _id: 'comp_2',
        name: 'InnovateX Labs',
        industry: 'AI & Data Science',
        website: 'https://innovatex.example.com',
        description: 'Pioneering AI research and product development.'
      }
    ];

    this.studentProfiles = [
      {
        _id: 'sp_1',
        user: 'student_demo_id',
        fullName: 'Alex Johnson',
        collegeId: '2026CS101',
        branch: 'Computer Science',
        course: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.8,
        phone: '+91 9876500001',
        skills: ['JavaScript', 'Node.js', 'React', 'Python'],
        resumeUrl: ''
      }
    ];

    this.recruiterProfiles = [
      {
        _id: 'rp_1',
        user: 'recruiter_demo_id',
        company: 'comp_1',
        designation: 'University Hiring Lead',
        verified: true
      }
    ];

    this.drives = [
      {
        _id: 'drive_1',
        title: 'Software Development Engineer (SDE-1)',
        company: 'comp_1',
        companyName: 'TechCorp Global',
        role: 'Full Stack Engineer',
        driveType: 'placement',
        description: 'Design, develop, and deploy cloud-native scalable web applications.',
        jobDescription: 'Design, develop, and deploy cloud-native scalable web applications.',
        package: 14.5,
        stipend: 0,
        ctc: '14.5 LPA',
        location: 'Bangalore / Remote',
        workMode: 'hybrid',
        minimumCGPA: 7.5,
        minCgpa: 7.5,
        eligibleBranches: ['Computer Science', 'Information Technology', 'Electronics'],
        eligibleCourses: ['B.Tech', 'M.Tech', 'MCA'],
        requiredSkills: ['JavaScript', 'Node.js', 'React', 'Python'],
        graduationYears: [2026, 2027],
        lastDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'published',
        createdBy: 'recruiter_demo_id',
        createdAt: new Date()
      },
      {
        _id: 'drive_2',
        title: 'Data Analyst & AI Engineer',
        company: 'comp_2',
        companyName: 'InnovateX Labs',
        role: 'Data Scientist Trainee',
        driveType: 'internship',
        description: 'Build machine learning pipelines and statistical models.',
        jobDescription: 'Build machine learning pipelines and statistical models.',
        package: 0,
        stipend: 35000,
        ctc: '12.0 LPA',
        location: 'Hyderabad / Pune',
        workMode: 'on-site',
        minimumCGPA: 8.0,
        minCgpa: 8.0,
        eligibleBranches: ['Computer Science', 'AI & ML', 'Data Science'],
        eligibleCourses: ['B.Tech', 'M.Tech'],
        requiredSkills: ['Python', 'SQL', 'TensorFlow', 'Data Analysis'],
        graduationYears: [2026],
        lastDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        status: 'published',
        createdBy: 'recruiter_demo_id',
        createdAt: new Date()
      }
    ];

    this.applications = [
      {
        _id: 'app_1',
        drive: 'drive_1',
        student: 'student_demo_id',
        status: 'Applied',
        appliedAt: new Date()
      }
    ];

    this.placements = [];
  }

  // User Methods
  findUserByEmail(email) {
    if (!email) return null;
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id) {
    return this.users.find(u => u._id === id || u._id.toString() === id.toString());
  }

  createUser(userData) {
    const _id = 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const hashedPassword = bcrypt.hashSync(userData.password, 10);
    const newUser = {
      _id,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      role: userData.role || 'student',
      phone: userData.phone || '',
      isActive: true,
      createdAt: new Date()
    };
    this.users.push(newUser);
    return newUser;
  }

  comparePassword(candidatePassword, hashedPassword) {
    return bcrypt.compareSync(candidatePassword, hashedPassword);
  }

  // Student Profile Methods
  getStudentProfile(userId) {
    let profile = this.studentProfiles.find(sp => sp.user === userId || sp.user.toString() === userId.toString());
    if (!profile) {
      const user = this.findUserById(userId);
      profile = {
        _id: 'sp_' + Date.now(),
        user: userId,
        fullName: user ? user.name : 'Student',
        collegeId: '2026CS' + Math.floor(100 + Math.random() * 900),
        branch: 'Computer Science',
        course: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.5,
        phone: user ? user.phone : '',
        skills: ['JavaScript', 'Node.js', 'Express'],
        resumeUrl: ''
      };
      this.studentProfiles.push(profile);
    }
    return profile;
  }

  updateStudentProfile(userId, data) {
    let profile = this.getStudentProfile(userId);
    Object.assign(profile, data);
    return profile;
  }

  // Recruiter Profile Methods
  getRecruiterProfile(userId) {
    let profile = this.recruiterProfiles.find(rp => rp.user === userId || rp.user.toString() === userId.toString());
    if (!profile) {
      profile = {
        _id: 'rp_' + Date.now(),
        user: userId,
        company: this.companies[0]._id,
        designation: 'HR Specialist',
        verified: true
      };
      this.recruiterProfiles.push(profile);
    }
    return profile;
  }

  // Company Methods
  findOrCreateCompany(companyName) {
    let comp = this.companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
    if (!comp) {
      comp = {
        _id: 'comp_' + Date.now(),
        name: companyName,
        industry: 'Technology',
        website: 'https://example.com',
        description: 'Corporate Partner'
      };
      this.companies.push(comp);
    }
    return comp;
  }

  // Drives Methods
  getAllDrives() {
    return this.drives;
  }

  getDriveById(id) {
    return this.drives.find(d => d._id === id || d._id.toString() === id.toString());
  }

  createDrive(driveData, userId) {
    const comp = this.findOrCreateCompany(driveData.companyName || 'Corporate Partner');
    const parsedBranches = Array.isArray(driveData.eligibleBranches)
      ? driveData.eligibleBranches
      : typeof driveData.eligibleBranches === 'string' ? driveData.eligibleBranches.split(',').map(b => b.trim()).filter(b => b.length > 0) : ['Computer Science'];
    const parsedSkills = typeof driveData.requiredSkills === 'string'
      ? driveData.requiredSkills.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : (Array.isArray(driveData.requiredSkills) ? driveData.requiredSkills : []);
    const parsedGradYears = typeof driveData.graduationYears === 'string'
      ? driveData.graduationYears.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y))
      : (Array.isArray(driveData.graduationYears) ? driveData.graduationYears : [2026]);

    const newDrive = {
      _id: 'drive_' + Date.now(),
      title: driveData.title,
      company: comp._id,
      companyName: comp.name,
      role: driveData.role || driveData.title,
      driveType: driveData.driveType || 'placement',
      description: driveData.description || driveData.jobDescription || 'Drive details and role description.',
      jobDescription: driveData.description || driveData.jobDescription || 'Drive details and role description.',
      package: driveData.package ? parseFloat(driveData.package) : 0,
      stipend: driveData.stipend ? parseFloat(driveData.stipend) : 0,
      ctc: driveData.ctc || (driveData.package ? `${driveData.package} LPA` : 'Negotiable'),
      location: driveData.location || 'Multiple Locations',
      workMode: driveData.workMode || 'on-site',
      minimumCGPA: driveData.minimumCGPA ? parseFloat(driveData.minimumCGPA) : (driveData.minCgpa ? parseFloat(driveData.minCgpa) : 0),
      minCgpa: driveData.minimumCGPA ? parseFloat(driveData.minimumCGPA) : (driveData.minCgpa ? parseFloat(driveData.minCgpa) : 0),
      eligibleBranches: parsedBranches,
      eligibleCourses: Array.isArray(driveData.eligibleCourses) ? driveData.eligibleCourses : [driveData.eligibleCourses || 'B.Tech'],
      requiredSkills: parsedSkills,
      graduationYears: parsedGradYears,
      lastDate: driveData.lastDate ? new Date(driveData.lastDate) : (driveData.deadline ? new Date(driveData.deadline) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
      deadline: driveData.lastDate ? new Date(driveData.lastDate) : (driveData.deadline ? new Date(driveData.deadline) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
      status: driveData.status || 'published',
      createdBy: userId,
      createdAt: new Date()
    };
    this.drives.push(newDrive);
    return newDrive;
  }

  // Applications Methods
  getStudentApplications(userId) {
    return this.applications.filter(a => a.student === userId || a.student.toString() === userId.toString());
  }

  applyForDrive(userId, driveId) {
    const existing = this.applications.find(a => (a.student === userId || a.student.toString() === userId.toString()) && (a.drive === driveId || a.drive.toString() === driveId.toString()));
    if (existing) return existing;

    const newApp = {
      _id: 'app_' + Date.now(),
      drive: driveId,
      student: userId,
      status: 'Applied',
      appliedAt: new Date()
    };
    this.applications.push(newApp);
    return newApp;
  }
}

const store = new InMemoryStore();
module.exports = store;
