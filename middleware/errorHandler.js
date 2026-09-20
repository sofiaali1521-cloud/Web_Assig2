const errorHandler = (err, req, res, next) => {
  console.error(`[Error Log] Path: ${req.path} | Error: ${err.message}`);
  
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Check for MongoDB connection / buffering errors
  if (err.message && (err.message.includes('buffering timed out') || err.message.includes('Topology is closed') || err.message.includes('before initial connection'))) {
    message = 'Database Connection Error: Cannot connect to MongoDB. Please add MONGODB_URI (MongoDB Atlas cloud URI) to Vercel Environment Variables and allow Network Access (0.0.0.0/0).';
  }

  // Handle Invalid Mongoose ObjectId Cast Errors
  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Requested resource not found or invalid identifier format';
  }

  const isDev = process.env.NODE_ENV === 'development';

  if (req.accepts('html')) {
    return res.status(statusCode).render('errors/500', {
      title: `${statusCode} - Server Error`,
      error: isDev ? err : {},
      message,
      statusCode
    });
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    stack: isDev ? err.stack : undefined
  });
};

module.exports = errorHandler;

