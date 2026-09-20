const errorHandler = (err, req, res, next) => {
  console.error(`[Error Log] Path: ${req.path} | Error: ${err.message}`);
  
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

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

