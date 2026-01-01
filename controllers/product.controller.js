const Product = require('../models/Product');
const User = require('../models/User');
const { sendMailSafe } = require('../utils/mailer');

/* =======================
   PUBLIC
======================= */

exports.getAllProducts = async (req, res) => {
  try {
    const filter = { status: 'approved', quantity: { $gt: 0 } };

    if (req.query.category)
      filter.category = new RegExp(`^${req.query.category}$`, 'i');
    if (req.query.search)
      filter.title = new RegExp(req.query.search, 'i');

    const products = await Product.find(filter);
    res.json(products);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Not found' });
    res.json(product);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getByCategory = async (req, res) => {
  try {
    const products = await Product.find({
      category: new RegExp(`^${req.params.categoryName}$`, 'i'),
      status: 'approved',
      quantity: { $gt: 0 },
    });
    res.json(products);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

/* =======================
   SELLER
======================= */

exports.getMyProducts = async (req, res) => {
  const products = await Product.find({ sellerId: req.user.id });
  res.json(products);
};

exports.createProduct = async (req, res) => {
  if (!req.files?.length)
    return res.status(400).json({ message: 'Images required' });

  const seller = await User.findById(req.user.id).select(
    'name email studentCode programType department year'
  );
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const product = await Product.create({
    title: req.body.title,
    price: Number(req.body.price),
    quantity: Number(req.body.quantity),
    description: req.body.description,
    category: req.body.category,
    imageUrl: req.files.map(f => f.path),
    sellerId: seller._id,
    sellerName: seller.name,
    sellerEmail: seller.email,
    status: 'pending',
  });

  /* =======================
     SELLER EMAIL
  ======================= */
  await sendMailSafe({
    to: seller.email,
    subject: 'Product uploaded – Under review',
    html: `
      <p>Hi ${seller.name},</p>
      <p>Your product <b>${product.title}</b> has been uploaded.</p>
      <p>It is currently under admin verification.</p>
      <p>You will be notified once it is approved or rejected.</p>
      <p>Thank you for selling on RebuZZar.</p>
      <br/>
      <p>– RebuZZar Team</p>
    `,
  });

  /* =======================
     🔔 ADMIN ALERT EMAIL
  ======================= */
  await sendMailSafe({
    to: process.env.ADMIN_EMAIL,
    subject: 'New Product Uploaded (Admin Alert)',
    html: `
      <h2>New Product Uploaded</h2>
      <p><b>Seller Name:</b> ${seller.name}</p>
      <p><b>Seller Email:</b> ${seller.email}</p>
      <p><b>Student Code:</b> ${seller.studentCode || 'N/A'}</p>
      <p><b>Program:</b> ${seller.programType}</p>
      <p><b>Department:</b> ${seller.department}</p>
      <p><b>Year:</b> ${seller.year}</p>
      <hr/>
      <p><b>Product Title:</b> ${product.title}</p>
      <p><b>Category:</b> ${product.category}</p>
      <p><b>Price:</b> ₹${product.price}</p>
      <p><b>Quantity:</b> ${product.quantity}</p>
      <p><b>Status:</b> Pending</p>
    `,
  });

  res.status(201).json(product);
};

/* =======================
   EDIT PRODUCT
======================= */

exports.updateProductBySeller = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ message: 'Product not found' });

    if (product.sellerId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Unauthorized' });

    const { title, price, description, category } = req.body;

    product.title = title;
    product.price = Number(price);
    product.description = description;
    product.category = category;
    product.status = 'pending';

    await product.save();

    res.json({
      success: true,
      message: 'Product updated. Awaiting admin re-approval.',
      product,
    });
  } catch (err) {
    console.error('UPDATE PRODUCT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });

  if (product.sellerId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Unauthorized' });

  await product.deleteOne();
  res.json({ message: 'Deleted' });
};
