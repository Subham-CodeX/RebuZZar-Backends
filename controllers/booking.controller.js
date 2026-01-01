const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Product = require('../models/Product');
const User = require('../models/User');
const { sendMailSafe } = require('../utils/mailer');

// =======================
// CREATE BOOKING
// =======================
exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { products, totalPrice } = req.body;

    if (!products || products.length === 0 || !totalPrice)
      throw new Error('Booking requires products and total price.');

    // Buyer
    const buyer = await User.findById(req.user.id)
      .select('name email studentCode programType department year')
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

    // Fetch product snapshot
    const dbProducts = await Product.find({
      _id: { $in: products.map(p => p.productId) },
    }).session(session);

    const bookingProducts = dbProducts.map(p => {
      const cartItem = products.find(
        i => String(i.productId) === String(p._id)
      );
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

    // =======================
    // BOOKING SUCCESS EMAIL
    // =======================
    const productList = booking.products
      .map(p => `<li>${p.title} × ${p.quantity}</li>`)
      .join('');

    await sendMailSafe({
      to: buyer.email,
      subject: 'Booking successful 🛒',
      html: `
        <p>Hi ${buyer.name},</p>
        <p>Your booking was successful.</p>
        <ul>${productList}</ul>
        <p><b>Total:</b> ₹${booking.totalPrice}</p>
        <p>You will receive your product within <b>48 hours</b>.</p>
        <br/>
        <p>Thanks for shopping on <b>RebuZZar</b>!</p>
        <br/>
        <p>– RebuZZar Team</p>
      `,
    });


     /* =======================
       🔔 SELLER EMAIL (NO BUYER INFO)
    ======================= */
    for (const p of booking.products) {
      await sendMailSafe({
        to: p.sellerEmail,
        subject: 'Your product has been booked 📦',
        html: `
          <p>Hello,</p>
          <p>Your product has been booked on <b>RebuZZar</b>.</p>
          <ul>
            <li><b>Product:</b> ${p.title}</li>
            <li><b>Quantity:</b> ${p.quantity}</li>
          </ul>
          <p>Please keep the product ready for dispatch.</p>
          <br/>
          <p>– RebuZZar Team</p>
        `,
      });
    }

        /* =======================
       🔔 ADMIN ALERT EMAIL
    ======================= */
    await sendMailSafe({
      to: process.env.ADMIN_EMAIL,
      subject: 'New Booking Placed (Admin Alert)',
      html: `
        <h2>New Booking</h2>

        <p><b>Buyer Details</b></p>
        <ul>
          <li>Name: ${buyer.name}</li>
          <li>Email: ${buyer.email}</li>
          <li>Student Code: ${buyer.studentCode || 'N/A'}</li>
          <li>Program: ${buyer.programType}</li>
          <li>Department: ${buyer.department}</li>
          <li>Year: ${buyer.year}</li>
        </ul>

        <hr/>

        <p><b>Booked Products</b></p>
        <ul>
          ${booking.products
            .map(
              p =>
                `<li>${p.title} × ${p.quantity} (₹${p.price})</li>`
            )
            .join('')}
        </ul>

        <p><b>Total Amount:</b> ₹${booking.totalPrice}</p>
        <p><b>Booking ID:</b> ${booking._id}</p>
      `,
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

// =======================
// GET MY BOOKINGS
// =======================
exports.getMyBookings = async (req, res) => {
  const bookings = await Booking.find({ buyerId: req.user.id })
    .populate('products.productId', 'title imageUrl')
    .sort({ bookingDate: -1 });

  res.json(bookings);
};

// =======================
// GET BOOKING BY ID
// =======================
exports.getBookingById = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('products.productId', 'title imageUrl price')
    .populate('buyerId', 'name email');

  if (!booking)
    return res.status(404).json({ message: 'Booking not found.' });

  res.json(booking);
};

// =======================
// CANCEL BOOKING
// =======================
exports.cancelBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('buyerId', 'name email studentCode programType department year')
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

  // =======================
  // BOOKING CANCEL EMAIL
  // =======================
  const productList = booking.products
    .map(p => `<li>${p.title} × ${p.quantity}</li>`)
    .join('');

  await sendMailSafe({
    to: booking.buyerId.email,
    subject: 'Booking cancelled',
    html: `
      <p>Your booking has been cancelled on ${new Date().toDateString()}.</p>
      <ul>${productList}</ul>
      <p>
        Visit <a href="${process.env.FRONTEND_URL}">
          RebuZZar
        </a> to continue shopping.
      </p>
      <br/>
      <p>– RebuZZar Team</p>
    `,
  });

  /* =======================
     🔔 SELLER CANCEL EMAIL (NO BUYER INFO)
  ======================= */
  for (const p of booking.products) {
    await sendMailSafe({
      to: p.sellerEmail,
      subject: 'Booked product cancelled ❌',
      html: `
        <p>Hello,</p>
        <p>A booking for your product has been cancelled on <b>RebuZZar</b>.</p>
        <ul>
          <li><b>Product:</b> ${p.title}</li>
          <li><b>Quantity:</b> ${p.quantity}</li>
        </ul>
        <p>The product quantity has been restored automatically.</p>
        <br/>
        <p>– RebuZZar Team</p>
      `,
    });
  }

  // =======================
  // 🔔 ADMIN ALERT – BOOKING CANCELLED
  // =======================
  await sendMailSafe({
    to: process.env.ADMIN_EMAIL,
    subject: 'Booking Cancelled (Admin Alert)',
    html: `
      <h2>❌ Booking Cancelled</h2>
      <p><b>Buyer Name:</b> ${booking.buyerId.name}</p>
      <p><b>Buyer Email:</b> ${booking.buyerId.email}</p>
      <p><b>Student Code:</b> ${booking.buyerId.studentCode || 'N/A'}</p>
      <p><b>Booking ID:</b> ${booking._id}</p>
      <p><b>Cancelled At:</b> ${new Date().toLocaleString()}</p>
      <hr/>
      <p><b>Cancelled Products:</b></p>
      <ul>${productList}</ul>
      <p><b>Total Amount:</b> ₹${booking.totalPrice}</p>
    `,
  });

  res.json({ message: 'Booking cancelled.', booking });
};
