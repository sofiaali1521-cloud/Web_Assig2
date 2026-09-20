const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const helmet = require('helmet');
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { setLocals } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const recruiterRoutes = require('./routes/recruiterRoutes');
const adminRoutes = require('./routes/adminRoutes');
const driveRoutes = require('./routes/driveRoutes');
const applicationRoutes = require('./routes/applicationRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

// Enable proxy trust for Vercel / reverse proxies
app.set('trust proxy', 1);

// Configure View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security & Utility Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false // Disabled CSP restrictions for EJS development inline resources
  })
);
const fs = require('fs');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Fail-safe handler for uploaded resume documents (handles serverless ephemeral disk missing files)
app.get('/uploads/resumes/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public/uploads/resumes', req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  // If file was uploaded in a previous serverless lambda instance and wiped, serve sample PDF fallback
  res.redirect('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
});

// Serverless DB Connection Middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Serverless DB middleware connection error:', err);
  }
  next();
});

// Configure Session Management
let sessionStore;
if (process.env.MONGODB_URI) {
  try {
    sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60 // 1 day session TTL
    });
    sessionStore.on('error', (err) => {
      console.error('[Session Store Error] MongoStore issue:', err.message);
    });
  } catch (err) {
    console.error('[Session Store Error] Failed to initialize MongoStore, falling back to MemoryStore:', err.message);
    sessionStore = new session.MemoryStore();
  }
} else {
  console.log('[Session Store] MONGODB_URI not set. Operating with standard MemoryStore for sessions.');
  sessionStore = new session.MemoryStore();
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'super_secret_placement_key_2026',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.VERCEL !== undefined
    }
  })
);

// Global Template Local Variables Middleware
app.use(setLocals);

// Mount Application Routes
app.use('/auth', authRoutes);
app.use('/student', studentRoutes);
app.use('/recruiter', recruiterRoutes);
app.use('/admin', adminRoutes);
app.use('/drives', driveRoutes);
app.use('/', applicationRoutes);

// Primary Homepage Route
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Campus Placement & Internship Management System'
  });
});

// Health-Check Route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Campus Placement & Internship Management System',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 Route Handler
app.use((req, res, next) => {
  const err = new Error('Page Not Found');
  err.statusCode = 404;
  if (req.accepts('html')) {
    return res.status(404).render('errors/404', { title: '404 - Page Not Found' });
  }
  next(err);
});

// Centralized Error Handler
app.use(errorHandler);

// Start Express Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 Campus Placement System Active at: http://localhost:${PORT}`);
    console.log(`===================================================`);
  });
}

module.exports = app;
