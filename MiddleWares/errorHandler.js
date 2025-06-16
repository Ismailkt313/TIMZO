const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err.stack || err.message);
  
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  
    // Handle API errors
    if (req.originalUrl.startsWith('/api')) {
      return res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
      });
    }
  
    // Handle 404
    if (statusCode === 404) {
      return res.render('error404', {
        title: '404- Not Found',
        message: err.message || 'Page Not Found',
        homeUrl: '/'
      });
    }
  
    // Handle general server errors
    return res.status(statusCode).render('error500', {
      title: 'Error',
      message: err.message || 'Something went wrong',
      status: statusCode,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack,
      homeUrl: '/'
    });
  };
  
  module.exports = errorHandler;


