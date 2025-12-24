// utils/logger.js
const logError = (context, error) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(`❌ ${context}:`, error);
  } else {
    console.error(
      `❌ ${context}:`,
      error && error.message ? error.message : error
    );
  }
};

module.exports = {
  logError,
};
