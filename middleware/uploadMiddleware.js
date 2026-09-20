const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');

// Determine destination upload directory (Vercel read-only filesystem support)
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const uploadDir = isVercel
  ? path.join(os.tmpdir(), 'uploads', 'resumes')
  : path.join(__dirname, '../public/uploads/resumes');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('Upload directory creation skipped or failed:', err.message);
}

// Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const userId = req.session && req.session.user ? req.session.user._id : 'user';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `resume-${userId}-${uniqueSuffix}${ext}`);
  }
});

// File Filter (PDF, DOC, DOCX allowed)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, and DOCX documents are allowed.'));
  }
};

const uploadResume = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

module.exports = {
  uploadResume
};
