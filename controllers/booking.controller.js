const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Product = require('../models/Product');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const { sendMailSafe } = require('../utils/mailer');

exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { products, totalPrice } = req.body;

    if (!products || products.length === 0 || !totalPrice)
      throw new Error('Booking requires products and total price.');

    // Buyer
    const buyer = await User.findById(req.user.id)
      .select('name email')
      .session(session);

    if (!buyer) throw new Error('Buyer not found');

    // Reduce stock atomically
    for (const item of products) {
      const qty = Number(item.quantity) || 1;

      const product = await Product.findOne({
        _id: item.productId,
        status: 'approved',
      }).session(session);

      if (!product) throw new Error('Product not found or not approved.');
      if (product.quantity < qty)
        throw new Error(`Only ${product.quantity} left for ${product.title}`);

      product.quantity -= qty;
      await product.save({ session });
    }

    // Fetch products snapshot
    const dbProducts = await Product.find({
      _id: { $in: products.map(p => p.productId) },
    }).session(session);

    const bookingProducts = dbProducts.map(p => {
      const cartItem = products.find(i => String(i.productId) === String(p._id));
      return {
        productId: p._id,
        title: p.title,
        price: cartItem?.price ?? p.price,
        quantity: Number(cartItem?.quantity) || 1,
        sellerId: p.sellerId,
        sellerName: p.sellerName,
        sellerEmail: p.sellerEmail,
      };
    });

    const [booking] = await Booking.create(
      [
        {
          buyerId: buyer._id,
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          products: bookingProducts,
          totalPrice,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // ---------------- EMAILS ----------------
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Buyer mail
    await transporter.sendMail({
      to: buyer.email,
      from: process.env.EMAIL_FROM,
      subject: 'Booking Confirmation — RebuZZar',
      html: `<p>Booking ID: ${booking._id}</p>`,
    });

    res.status(201).json({
      message: 'Booking successful!',
      bookingId: booking._id,
      booking,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    res.status(409).json({
      message: err.message || 'Booking failed due to concurrent access.',
    });
  }
};

exports.getMyBookings = async (req, res) => {
  const bookings = await Booking.find({ buyerId: req.user.id })
    .populate('products.productId', 'title imageUrl')
    .sort({ bookingDate: -1 });

  res.json(bookings);
};

exports.getBookingById = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('products.productId', 'title imageUrl price')
    .populate('buyerId', 'name email');

  if (!booking)
    return res.status(404).json({ message: 'Booking not found.' });

  res.json(booking);
};

exports.cancelBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('buyerId', 'name email')
    .populate({
      path: 'products.productId',
      populate: { path: 'sellerId', select: 'name email' },
    });

  if (!booking)
    return res.status(404).json({ message: 'Booking not found.' });

  if (booking.buyerId._id.toString() !== req.user.id.toString())
    return res.status(403).json({ message: 'Unauthorized.' });

  if (['Cancelled', 'Delivered'].includes(booking.status))
    return res.status(400).json({ message: 'Cannot cancel this booking.' });

  booking.status = 'Cancelled';
  await booking.save();

  // Restore stock
  for (const item of booking.products) {
    await Product.findByIdAndUpdate(item.productId._id, {
      $inc: { quantity: item.quantity },
    });
  }

  sendMailSafe({
    to: booking.buyerId.email,
    from: process.env.EMAIL_FROM,
    subject: 'Booking Cancelled',
    html: '<p>Your booking was cancelled.</p>',
  });

  res.json({ message: 'Booking cancelled.', booking });
};
