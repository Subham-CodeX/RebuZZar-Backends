// middlewares/error.middleware.js
module.exports = (err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error:', err);
  } else {
    console.error('❌ Error:', err?.message || err);
  }

  const status = err.statusCode || 500;

  res.status(status).json({
    message: err.message || 'Internal Server Error',
  });
};
