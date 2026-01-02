// app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('passport');
const mongoSanitize = require('express-mongo-sanitize');

// DB connection
const connectDB = require('./config/db');

// Passport config
require('./config/passport');

// Cron jobs
require('./jobs/adExpiry.cron');

// Error handler
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// ----------------------------
// CONNECT DATABASE
// ----------------------------
connectDB();

// ----------------------------
// GLOBAL MIDDLEWARE
// ----------------------------
app.use(helmet());

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(passport.initialize());

// Mongo sanitize (safe version)
app.use((req, res, next) => {
  req.query = { ...req.query };
  mongoSanitize.sanitize(req.query);
  next();
});

// ----------------------------
// ROOT ROUTE
// ----------------------------
app.get('/', (req, res) => {
  res.status(200).send(`
    <h1>🚀 RebuZZar Backend API</h1>
    <p>Server is running successfully.</p>
  `);
});

// ----------------------------
// ROUTES
// ----------------------------
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/bookings', require('./routes/booking.routes'));
app.use('/api/ads', require('./routes/ad.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/profile', require('./routes/profile.routes'));
app.use('/api/user', require('./routes/user.routes'));
app.use('/api/admin/email', require('./routes/adminBroadcastEmail.routes'));



// ----------------------------
// ERROR HANDLER (ALWAYS LAST)
// ----------------------------
app.use(errorHandler);

module.exports = app;
