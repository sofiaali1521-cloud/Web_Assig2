# Campus Placement & Internship Management System

A full-stack enterprise campus placement portal built with **Node.js**, **Express.js**, **EJS**, and **MongoDB (Mongoose)**. The platform streamlines and automates university placement operations, recruiter hiring workflows, student application tracking, eligibility validation, and placement policy enforcement.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Main Features](#3-main-features)
4. [User Roles](#4-user-roles)
5. [Student Features](#5-student-features)
6. [Recruiter Features](#6-recruiter-features)
7. [Admin (TPO) Features](#7-admin-tpo-features)
8. [Eligibility Engine](#8-eligibility-engine)
9. [Application Status Pipeline](#9-application-status-pipeline)
10. [Placement Policy](#10-placement-policy)
11. [Database Models](#11-database-models)
12. [Technology Stack](#12-technology-stack)
13. [Folder Structure](#13-folder-structure)
14. [Authentication & Authorization](#14-authentication--authorization)
15. [Environment Variables](#15-environment-variables)
16. [MongoDB Atlas Setup](#16-mongodb-atlas-setup)
17. [Local Installation Steps](#17-local-installation-steps)
18. [How to Run the Project](#18-how-to-run-the-project)
19. [Admin Account Setup](#19-admin-account-setup)
20. [Testing Instructions](#20-testing-instructions)
21. [Deployment Instructions](#21-deployment-instructions)
22. [GitHub Setup & Push Guide](#22-github-setup--push-guide)
23. [Future Improvements](#23-future-improvements)

---

## 1. Project Overview

The **Campus Placement & Internship Management System** is a unified, multi-role web platform designed for higher education institutions. It connects three primary stakeholders—**Students**, **Corporate Recruiters**, and the **Training & Placement Office (TPO Admin)**—into a synchronized ecosystem. The platform enforces strict college placement rules, evaluates eligibility real-time on the server, manages recruitment pipelines, and presents analytics dashboards with dynamic MongoDB metrics.

---

## 2. Problem Statement

Traditional university placement procedures often rely on fragmented spreadsheets, manual email chains, unverified recruiter listings, and non-enforceable placement guidelines. This manual workflow leads to:
* High rates of student ineligible applications.
* Lack of recruiter account verification.
* Non-transparent application status tracking for students.
* Difficulty in enforcing "One Student, One Placement" college policies.
* Inefficient TPO oversight over corporate hiring drives.

This platform solves these challenges by providing a centralized database, zero-trust server-side eligibility checks, strict tenant isolation, and automated status pipeline controls.

---

## 3. Main Features

* **Multi-Role User Management**: Custom interfaces and authorization tiers for Students, Recruiters, and TPO Admins.
* **TPO Recruiter Verification Gate**: Unverified recruiters are restricted from publishing placement drives until vetted by the TPO.
* **Automated Eligibility Engine**: Server-side 9-point criteria evaluation before allowing student application submission.
* **Placement Policy Enforcement**: Automatic lock preventing placed full-time students from applying to further placement drives.
* **Controlled Status Pipeline**: Regulated application state progression (`Applied` ➔ `Shortlisted` ➔ `Interviewed` ➔ `Selected` / `Rejected`, or `Withdrawn`).
* **Dynamic Dashboards**: Real-time stats powered by MongoDB aggregation pipelines (0 hardcoded mock statistics).
* **Responsive Dark / Light Mode**: Unified CSS design tokens supporting seamless theme switching and mobile-responsive drawer navigation.
* **Zero-Trust Tenant Isolation**: Cross-student and cross-recruiter URL access attempts are blocked with HTTP 403 Forbidden responses.

---

## 4. User Roles

1. **Student**: Enrolled students seeking full-time campus placements or internships.
2. **Recruiter**: Corporate recruiters representing verified hiring companies.
3. **Admin (TPO Officer)**: Placement officers superintending university drives, recruiters, student records, and college policy state.

---

## 5. Student Features

* **Account & Profile Management**: Complete profile with branch, CGPA, graduation year, technical skills, and resume link. Profile completion progress tracking.
* **Drive Discovery & Search**: Filter drives by type (Full-time Placement vs. Internship), minimum CGPA cutoff, eligible branch, salary range, company name, and status.
* **Real-time Eligibility Breakdown**: Live visual check showing exact reasons why a student is eligible or ineligible for a specific drive before applying.
* **One-Click Application Submission**: Apply to eligible drives with automatic policy checks.
* **Application History**: Filter and monitor past applications across all pipeline stages with interview dates and rejection feedback.
* **Placement Status Dossier**: View full placement record details once selected for a role.

---

## 6. Recruiter Features

* **Company Profile Setup**: Manage company website, domain, industry, bio, location, logo, and contact email.
* **TPO Approval Status Indicator**: Prominent verification banner indicating whether the recruiter account is pending, approved, or rejected.
* **Drive Management**: Create, edit, save draft, publish, or close placement and internship drives.
* **Applicant Pipeline Management**: Filter applicants per drive, view detailed student dossiers, inspect CGPA/skills/resumes, and update application status through controlled transition gates.
* **Interview Scheduling**: Assign interview dates and feedback notes to shortlisted candidates.

---

## 7. Admin (TPO) Features

* **Platform Executive Dashboard**: High-level university metrics (Total Students, Verified Recruiters, Active Drives, Total Placements, Placement Percentage).
* **Recruiter Verification Oversight**: Review pending recruiter registrations and approve/reject company accounts with 1-click controls.
* **Global Drive Management**: View, search, filter, publish, or close drives created across all recruiters.
* **Universal Application Audit**: Search and filter all student applications institution-wide by company, branch, CGPA range, graduation year, and status.
* **Placement Records Management**: Track placed students, average package statistics, and manage individual student placement policy exemptions.

---

## 8. Eligibility Engine

When a student attempts to apply for a placement or internship drive, the backend [`services/eligibilityService.js`](file:///Users/sofiya/Antigravity/Management/services/eligibilityService.js) evaluates **9 mandatory rules**:

1. **Profile Completeness**: CGPA, branch, graduation year, and resume link must be filled.
2. **Drive Status**: Drive must be in `Published` state.
3. **Application Deadline**: Current date must be before or equal to the application deadline.
4. **Recruiter Verification**: Hosting recruiter account must be TPO-verified (`isVerified: true`).
5. **Branch Eligibility**: Student's branch must match the drive's eligible branches list.
6. **Minimum CGPA Cutoff**: Student's CGPA must satisfy `student.cgpa >= drive.minCgpa`.
7. **Target Graduation Year**: Student's graduation year must match the drive's target year.
8. **Required Skills**: Student must possess at least one or all required skills specified by the recruiter.
9. **College Placement Policy**: If applying for a `Placement` drive, the student must not already have an active `Selected` placement record.

---

## 9. Application Status Pipeline

Applications move through a strict, state-machine regulated pipeline:

```
[ Applied ] ──► [ Shortlisted ] ──► [ Interviewed ] ──┬──► [ Selected ]
     │                                                │
     └──► [ Withdrawn ]                               └──► [ Rejected ]
```

* **Transition Rules**:
  - `Applied` ➔ `Shortlisted` or `Withdrawn`
  - `Shortlisted` ➔ `Interviewed` or `Withdrawn`
  - `Interviewed` ➔ `Selected` or `Rejected`
  - *Direct jumping (e.g., Applied ➔ Selected) is blocked on the server.*

---

## 10. Placement Policy

* **Policy Rule**: When a student's status changes to `Selected` for a **Placement** (full-time) drive:
  1. An atomic `PlacementRecord` document is created/updated.
  2. The student's `isPlaced` flag is set to `true`.
  3. The student is immediately blocked from applying to any future **Placement** drives.
* **Internship Policy**: Students selected for full-time placements remain permitted to apply for **Internship** drives (unless explicitly restricted by TPO Admin override).
* **Policy State Inspection**: Both Students and Admins can view real-time policy evaluation states directly on their dashboard interfaces.

---

## 11. Database Models

The MongoDB schema structure consists of 6 primary Mongoose models (`models/`):

1. **`User`**: Base authentication collection (`name`, `email`, `password` hashed with bcrypt, `role` [`student`|`recruiter`|`admin`], `isVerified`, `isActive`).
2. **`StudentProfile`**: Refers to `User` (`branch`, `cgpa`, `graduationYear`, `skills`, `resumeUrl`, `isPlaced`, `placementRecord`).
3. **`CompanyProfile`**: Refers to `User` (`companyName`, `website`, `industry`, `companySize`, `headquarters`, `description`, `logo`).
4. **`Drive`**: Refers to `User` recruiter (`title`, `companyName`, `driveType` [`Placement`|`Internship`], `role`, `packageOffered`, `stipend`, `jobLocation`, `minCgpa`, `eligibleBranches`, `graduationYear`, `requiredSkills`, `deadline`, `status` [`Draft`|`Published`|`Closed`]).
5. **`Application`**: Refers to `StudentProfile` & `Drive` (`status` [`Applied`|`Shortlisted`|`Interviewed`|`Selected`|`Rejected`|`Withdrawn`], `appliedAt`, `interviewDate`, `notes`, `rejectionReason`).
6. **`PlacementRecord`**: Refers to `StudentProfile`, `Drive`, & `CompanyProfile` (`packageOffered`, `designation`, `placedAt`).

---

## 12. Technology Stack

* **Core Runtime**: Node.js (v18+)
* **Web Framework**: Express.js (v4.21+)
* **Template Engine**: EJS (Embedded JavaScript) with layouts and partials
* **Database**: MongoDB with Mongoose ORM (v8.7+)
* **Session Storage**: `express-session` with `connect-mongo` session store
* **Security & Auth**: `bcryptjs` password hashing, `helmet` HTTP headers, zero-trust RBAC middleware
* **Styling**: Vanilla CSS Design Tokens, Glassmorphism, Responsive CSS Grid/Flexbox, Dark/Light Mode
* **Data Visualization**: Chart.js (via CDN in EJS partials)

---

## 13. Folder Structure

```
Management/
├── app.js                   # Application entry point & Express middleware setup
├── package.json             # Node dependencies & execution scripts
├── .env.example             # Environment configuration template
├── .gitignore              # Git file exclusion rules
├── config/
│   └── db.js                # Mongoose database connection initialization
├── controllers/
│   ├── adminController.js   # TPO dashboard & oversight logic
│   ├── applicationController.js # Application submission & pipeline handlers
│   ├── authController.js    # Login, registration, session management
│   ├── dashboardController.js   # Dynamic student dashboard metrics
│   ├── driveController.js   # Drive creation, editing, discovery, search
│   ├── recruiterController.js # Recruiter dashboard & profile logic
│   └── studentController.js # Student profile management & history
├── middleware/
│   ├── authMiddleware.js    # Session auth & RBAC route guards
│   └── errorHandler.js      # Centralized 404, CastError, and 500 error handler
├── models/
│   ├── Application.js       # Mongoose Application Schema
│   ├── CompanyProfile.js    # Mongoose Company Profile Schema
│   ├── Drive.js             # Mongoose Drive Schema
│   ├── PlacementRecord.js   # Mongoose Placement Record Schema
│   ├── StudentProfile.js    # Mongoose Student Profile Schema
│   └── User.js              # Mongoose User Authentication Schema
├── public/
│   ├── css/                 # Global styles & theme design system
│   ├── js/                  # Client-side theme toggler & interactivity
│   └── uploads/             # Static file upload destination (.gitkeep preserved)
├── routes/
│   ├── adminRoutes.js       # Administrative route endpoints
│   ├── applicationRoutes.js # Student application submission endpoints
│   ├── authRoutes.js        # Auth login/logout/register endpoints
│   ├── driveRoutes.js       # Drive search & creation endpoints
│   ├── recruiterRoutes.js   # Recruiter management endpoints
│   └── studentRoutes.js     # Student profile & history endpoints
├── scripts/
│   └── seed-admin.js        # Admin CLI creation script
├── services/
│   └── eligibilityService.js # Server-side eligibility & policy validator
└── views/
    ├── admin/               # Admin EJS templates
    ├── auth/                # Auth EJS login & register templates
    ├── drives/              # Drive discovery & dossier EJS templates
    ├── errors/              # 404 & 500 error pages
    ├── partials/            # Shared EJS partials (navbar, footer, flash alerts)
    ├── recruiter/           # Recruiter pipeline EJS templates
    └── student/             # Student dashboard & profile EJS templates
```

---

## 14. Authentication & Authorization

* **Passwords**: Hashed securely using `bcryptjs` with standard salt rounds.
* **Session Management**: Server-side sessions persisted in MongoDB via `connect-mongo`. Cookies are configured with `httpOnly: true` and `secure: true` in production environments.
* **RBAC Route Protection Middleware**:
  - `isAuthenticated`: Ensures active session.
  - `isStudent`: Restricts routes strictly to `student` role users.
  - `isRecruiter`: Restricts routes strictly to `recruiter` role users.
  - `isApprovedRecruiter`: Restricts drive creation to recruiters with `isVerified: true`.
  - `isAdmin`: Restricts administrative operations strictly to `admin` role users.

---

## 15. Environment Variables

Copy `.env.example` to `.env` in the root of `Management/`:

```bash
cp .env.example .env
```

Set the following parameters:

| Variable | Description | Default / Recommended |
| :--- | :--- | :--- |
| `PORT` | Web server port | `3002` |
| `MONGODB_URI` | Connection URI for local MongoDB or MongoDB Atlas | `mongodb://127.0.0.1:27017/placement_management_db` |
| `SESSION_SECRET` | Secret string for signing session cookies | `random_long_secure_string_here` |
| `NODE_ENV` | Mode (`development` or `production`) | `development` |
| `ADMIN_EMAIL` | Optional email for seeding admin account | `admin@placement.edu` |
| `ADMIN_PASSWORD` | Optional password for seeding admin account | `Admin@123456` |

---

## 16. MongoDB Atlas Setup

To connect the application to a cloud-hosted MongoDB Atlas cluster:

1. **Create an Atlas Account**: Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. **Build a Cluster**: Create a free M0 Shared Cluster or dedicated instance.
3. **Database Access**: Create a Database User with read/write credentials.
4. **Network Access**: Add IP address `0.0.0.0/0` (or specific deployment server IP) to IP Access List.
5. **Get Connection String**: Click **Connect** ➔ **Drivers (Node.js)** ➔ Copy the URI string.
6. **Update `.env`**: Set `MONGODB_URI` to your Atlas string:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/placement_management_db?retryWrites=true&w=majority
   ```

---

## 17. Local Installation Steps

1. **Clone the Repository**:
   ```bash
   git clone <your-repository-url>
   cd Management
   ```

2. **Install Node Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment File**:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to configure your MongoDB connection string and session secret.*

---

## 18. How to Run the Project

* **Development Mode** (auto-reloads on file edits via `--watch`):
  ```bash
  npm run dev
  ```

* **Production Mode**:
  ```bash
  npm start
  ```

Access the application in your browser at: `http://localhost:3002` (or configured `PORT`).

---

## 19. Admin Account Setup

To seed the initial Head TPO Admin account into your database:

```bash
npm run seed:admin
# OR
npm run create-admin
```

**Default Admin Credentials**:
* **Email**: `admin@placement.edu`
* **Password**: `Admin@123456`

*(You can override default admin credentials by providing `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your `.env` file prior to running the script).*

---

## 20. Testing Instructions

To run the complete automated E2E test suite covering Student workflows, Recruiter verification, Admin oversight, 9 Eligibility rules, Security isolation, and Placement Policy checks:

```bash
node scratch/test-part19-master-e2e.js
```

---

## 21. Deployment Instructions

### Deployment to Render / Railway / Heroku

1. **Prepare Environment Variables**:
   In your platform dashboard (Render, Railway, Heroku, AWS Elastic Beanstalk), add the following Environment Variables:
   - `NODE_ENV=production`
   - `PORT=3002` (or set automatically by provider)
   - `MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/placement_db`
   - `SESSION_SECRET=<generated_random_secret>`

2. **Configure Build & Start Commands**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Deploy Repository**:
   Connect your GitHub repository to Render/Railway for automated continuous deployments upon git push.

---

## 22. GitHub Setup & Push Guide

To push this project to a new GitHub repository:

1. **Initialize Git Repository** (if not already initialized):
   ```bash
   git init
   ```

2. **Add Source Files**:
   ```bash
   git add .
   ```

3. **Verify Staged Files** (Ensure `.env` and `node_modules` are excluded):
   ```bash
   git status
   ```

4. **Create First Commit**:
   ```bash
   git commit -m "feat: complete Campus Placement & Internship Management System"
   ```

5. **Connect GitHub Remote**:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   ```

6. **Push to GitHub**:
   ```bash
   git branch -M main
   git push -u origin main
   ```

---

## 23. Future Improvements

* **Email & SMS Notifications**: Integrated SMTP/Twilio alerts when application status changes or interviews are scheduled.
* **Resume PDF Parsing**: Automated skill extraction from uploaded PDF resumes using Natural Language Processing.
* **Calendar Integrations**: Automated Google Calendar / Outlook sync for scheduled recruiter interviews.
* **AI Skill & Job Matching**: Machine learning matching score recommendations between student profiles and posted drives.
