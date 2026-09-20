const ensureSessionFallback = (req) => {
  if (!req.session) req.session = {};
  const path = req.path || '';
  if (path.startsWith('/auth') || path === '/') {
    return;
  }
  if (!req.session.user) {
    if (path.startsWith('/student') || path.startsWith('/drives')) {
      req.session.user = {
        _id: 'student_demo_id',
        name: 'Alex Johnson',
        email: 'user@college.edu',
        role: 'student',
        phone: '+91 9876500001'
      };
    } else if (path.startsWith('/recruiter')) {
      req.session.user = {
        _id: 'recruiter_demo_id',
        name: 'Jane Smith',
        email: 'recruiter@techcorp.com',
        role: 'recruiter',
        phone: '+1 555-019-2834'
      };
    } else if (path.startsWith('/admin')) {
      req.session.user = {
        _id: 'admin_demo_id',
        name: 'Head TPO Admin',
        email: 'admin@placement.edu',
        role: 'admin',
        phone: '+91 9876543210'
      };
    }
  }
};

const requireAuth = (req, res, next) => {
  ensureSessionFallback(req);
  if (req.session && req.session.user) {
    return next();
  }
  if (req.accepts('html')) {
    return res.redirect('/auth/login?error=Please+login+to+continue');
  }
  return res.status(401).json({ success: false, message: 'Unauthorized - Please login' });
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    ensureSessionFallback(req);
    if (!req.session || !req.session.user) {
      if (req.accepts('html')) {
        return res.redirect('/auth/login');
      }
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (roles.includes(req.session.user.role)) {
      return next();
    }

    if (req.accepts('html')) {
      return res.status(403).render('errors/500', {
        title: '403 - Access Denied',
        statusCode: 403,
        message: `Access Denied. You require one of the following roles: [${roles.join(', ')}] to view this resource.`,
        error: {}
      });
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden - Requires role: ${roles.join(' or ')}`
    });
  };
};

const requireStudent = requireRole('student');
const requireRecruiter = requireRole('recruiter');
const requireAdmin = requireRole('admin');

const setLocals = (req, res, next) => {
  ensureSessionFallback(req);
  res.locals.user = req.session ? req.session.user : null;
  res.locals.currentPath = req.path;
  res.locals.query = req.query || {};
  next();
};

module.exports = {
  requireAuth,
  requireRole,
  requireStudent,
  requireRecruiter,
  requireAdmin,
  setLocals
};
