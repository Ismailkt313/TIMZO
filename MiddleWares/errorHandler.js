const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err.stack);

    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

    if (req.originalUrl.startsWith('/api')) {
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Internal Server Error',
            stack: process.env.NODE_ENV === 'production' ? null : err.stack,
        });
    }

    if (statusCode === 404) {
        return res.status(404).render('error404', {
            message: err.message || 'Page Not Found',
        });
    }

    res.status(statusCode).render('error404', {
        message: err.message || 'Something went wrong',
        status: statusCode,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = errorHandler;
