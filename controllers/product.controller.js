const Product = require('../models/Product');
const User = require('../models/User');

// PUBLIC
exports.getAllProducts = async (req, res) => {
  const filter = { status: 'approved', quantity: { $gt: 0 } };
  if (req.query.category)
    filter.category = new RegExp(`^${req.query.category}$`, 'i');
  if (req.query.search)
    filter.title = new RegExp(req.query.search, 'i');

  const products = await Product.find(filter);
  res.json(products);
};

exports.getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  res.json(product);
};

exports.getByCategory = async (req, res) => {
  const products = await Product.find({
    category: new RegExp(`^${req.params.categoryName}$`, 'i'),
    status: 'approved',
    quantity: { $gt: 0 },
  });
  res.json(products);
};

// SELLER
exports.getMyProducts = async (req, res) => {
  const products = await Product.find({ sellerId: req.user.id });
  res.json(products);
};

exports.createProduct = async (req, res) => {
  if (!req.files?.length)
    return res.status(400).json({ message: 'Images required' });

  const seller = await User.findById(req.user.id).select('name email');
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
    status: 'pending', // SAME LOGIC
  });

  // Product upload mail
const { sendMailSafe } = require('../utils/mailer');

await sendMailSafe({
  to: seller.email,
  subject: 'Product uploaded – Under review',
  html: `
    <p>Hi ${seller.name},</p>
    <p>Your product <b>${product.title}</b> has been uploaded successfully.</p>
    <p>It is currently under admin verification.</p>
    <p>You will be notified once it is approved or rejected.</p>
    <p>Thank you for selling on RebuZZar.</p>
    <br/>
    <p>– RebuZZar Team</p>
  `,
});

  res.status(201).json(product);
};


exports.deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });

  if (product.sellerId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Unauthorized' });

  await product.deleteOne();
  res.json({ message: 'Deleted' });
};
