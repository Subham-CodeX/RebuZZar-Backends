// routes/booking.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');

const bookingController = require('../controllers/booking.controller');

router.post('/create', auth, bookingController.createBooking);
router.get('/my-bookings', auth, bookingController.getMyBookings);
router.get('/:id', auth, bookingController.getBookingById);
router.put('/:id/cancel', auth, bookingController.cancelBooking);

module.exports = router;
