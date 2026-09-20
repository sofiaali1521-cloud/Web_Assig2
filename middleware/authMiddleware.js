const requireAuth = (req, res, next) => {
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
