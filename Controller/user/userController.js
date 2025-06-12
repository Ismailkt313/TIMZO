const User = require('../../Model/userSchema')
const Product = require("../../Model/productSchema")
const Category = require("../../Model/categorySchema")
const Brand = require("../../Model/brandschema")
const Cart = require("../../Model/cartSchema")
const Review = require('../../Model/review')
const mongoose = require('mongoose');
const Wishlist = require("../../Model/wishlistSchema")
const Wallet = require("../../Model/walletSchema")
const nodemailer = require('nodemailer')
const { v4: uuidv4 } = require('uuid');
const env = require('dotenv').config()
const bcrypt = require("bcrypt")

const pageNotFound = async (req, res) => {
  try {
    res.render('error404')
  } catch (error) {
    res.redirect('/error404')
  }
}

const loadlanding = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isListed: true });
    const user = req.session.user || null

    console.log('Session userId in loadlanding:', req.session.user?._id);

    let wishlist = [];
    if (user) {
      const wishlistDoc = await Wishlist.findOne({ userId: user._id }).populate({
        path: 'products.productId',
        match: { isListed: true }
      });
      wishlist = wishlistDoc
        ? wishlistDoc.products
          .filter(item => item.productId)
          .map(item => item.productId._id.toString())
        : [];
      console.log('Wishlist product IDs in loadlanding:', wishlist);
    }

    let newArrivals = await Product.find({ isListed: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('brand')
      .populate('category');
    newArrivals = newArrivals.filter(p => p.brand?.isListed && p.category?.isListed && p.isListed && !p.isBlocked && p.status === 'available');

    let trendingProducts = await Product.find({ isListed: true })
      .sort({ createdAt: 1 })
      .limit(10)
      .populate('brand')
      .populate('category');
    trendingProducts = trendingProducts.filter(p => p.brand?.isListed && p.category?.isListed && p.isListed && !p.isBlocked && p.status === 'available');

    let exploreProducts = await Product.find({ isListed: true })
      .populate('brand')
      .populate('category')
      .limit(12);
    exploreProducts = exploreProducts.filter(p => p.brand?.isListed && p.category?.isListed && p.isListed && !p.isBlocked && p.status === 'available');

    let cartCount
    if (user) {
      const cart = await Cart.findOne({ user: user._id }).populate('items.product');
      if (cart) {
        cartCount = cart.items.reduce((sum, item) => {
          if (item.product && item.product.isListed && item.product.status === 'available') {
            return sum + item.quantity;
          }
          return sum;
        }, 0);
      }
    }



    return res.render('user/landingPage', {
      user,
      cartCount,
      newArrivals,
      trendingProducts,
      exploreProducts,
      categories,
      brands,
      wishlist,
      search: req.query.search || ''
    });
  } catch (error) {
    console.error('Error loading user homepage:', error);
    res.status(500).render('user/error', {
      message: 'Server error',
      user: req.session.user || null,
      cartCount: 0,
      search: req.query.search || ''
    });
  }
};


const loadSignUp = async (req, res) => {
  try {
    return res.render('user/signUp', { error: null, formData: {} });
  } catch (error) {
    res.redirect('/user/error404');
  }
};


function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000);
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    })

    const info = await transporter.sendMail({
      from: `"Timzo Support" <${process.env.NODEMAILER_EMAIL}>.com`,
      to: email,
      subject: "Verify Your Timzo Account ✔",
      text: `Your OTP is: ${otp}`,
      html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 10px; background: #f4f4f4;">
                <h2 style="color: #333;">Welcome to <span style="color: #27ae60;">Timzo</span>!</h2>
                <p>Thanks for signing up! Use the OTP below to verify your account:</p>
                <div style="padding: 15px; background: #fff; border-radius: 8px; margin: 20px 0; text-align: center;">
                  <h1 style="color: #27ae60;">${otp}</h1>
                </div>
                <p>If you didn’t request this, you can ignore it.</p>
                <p style="font-size: 12px; color: #999; margin-top: 30px;">
                  Timzo Inc. | timzo.com | support@timzo.com
                </p>
              </div>
            `,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'Timzo Mailer'
      }
    }
    )



    return info.accepted.length > 0


  } catch (error) {
    console.error("ERROR SENDING EMAIL", error);
    return false

  }
}




const signup = async (req, res) => {
  try {
    const { fullname, email, mobile, password, conformPassword, referralCode } = req.body;

    if (!fullname || !email || !mobile || !password || !conformPassword) {
      return res.render('user/signUp', {
        error: "All fields are required",
        formData: { fullname, email, mobile, referralCode }
      });
    }

    const nameRegex = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
    if (!nameRegex.test(fullname.trim())) {
      return res.render('user/signUp', {
        error: "Please enter a valid full name (letters and spaces only)",
        formData: { fullname, email, mobile, referralCode }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.render('user/signUp', {
        error: "Please enter a valid email address",
        formData: { fullname, email, mobile, referralCode }
      });
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile.trim())) {
      return res.render('user/signUp', {
        error: "Please enter a valid 10-digit mobile number starting with 6-9",
        formData: { fullname, email, mobile, referralCode }
      });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.render('user/signUp', {
        error: "Password must be at least 6 characters and include a number",
        formData: { fullname, email, mobile, referralCode }
      });
    }

    if (password !== conformPassword) {
      return res.render('user/signUp', {
        error: "Passwords do not match",
        formData: { fullname, email, mobile, referralCode }
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('user/signUp', {
        error: "Email already registered",
        formData: { fullname, email, mobile, referralCode }
      });
    }

    const otp = generateOtp();
    const emailsent = await sendVerificationEmail(email, otp);
    if (!emailsent) {
      return res.json('email error');
    }

    const generateReferralCode = () => {
      return uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();
    };

    const userReferralCode = generateReferralCode();

    req.session.userOtp = {
      code: otp,
      expiresAt: Date.now() + 30 * 1000
    }
    req.session.userData = {
      fullname,
      email,
      mobile,
      password,
      referralCode,
      userReferralCode
    };

    res.render('user/verifyOtp', { error: null });
    console.log('OTP sent:', otp);

  } catch (error) {
    console.error('Error during signup:', error.message);
    res.status(500).redirect('/user/error404');
  }
};
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10)

    return passwordHash

  } catch (error) {
    console.error("Password hash error:", error);
    throw error;

  }
}

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ success: false, error: "OTP is required." });
    }

    const now = Date.now();

    if (
      req.session.userOtp &&
      otp == req.session.userOtp.code &&
      now <= req.session.userOtp.expiresAt
    ) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      let referredByUser = null;

      if (user.referralCode) {
        referredByUser = await User.findOne({ referralCode: user.referralCode });
      }

      const newUser = new User({
        fullname: user.fullname,
        email: user.email,
        password: passwordHash,
        mobile: user.mobile,
        referralCode: user.userReferralCode,
        referredBy: referredByUser ? referredByUser._id : null
      });

      await newUser.save();

      const newWallet = new Wallet({
        userId: newUser._id,
        balance: 0,
        transactions: []
      });
      await newWallet.save();

      if (referredByUser) {
        const referrerWallet = await Wallet.findOne({ userId: referredByUser._id });

        if (referrerWallet) {
          referrerWallet.balance += 50;
          referrerWallet.transactions.push({
            type: 'credit',
            amount: 50,
            description: `Referral bonus for inviting ${user.email}`
          });
          await referrerWallet.save();
        } else {
          await Wallet.create({
            userId: referredByUser._id,
            balance: 50,
            transactions: [{
              type: 'credit',
              amount: 50,
              description: `Referral bonus for inviting ${user.email}`
            }]
          });
        }

        console.log(`₹50 credited to ${referredByUser.email}'s wallet`);
      }

      req.session.user = newUser;
      return res.status(200).json({ success: true, redirect: "/user/" });

    } else {
      return res.status(400).json({ success: false, error: "Incorrect OTP. Please try again." });
    }

  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({ success: false, error: "An error occurred during OTP verification." });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res.status(400).json({ success: false, error: "Session expired" });
    }

    const newOtp = generateOtp();
    req.session.userOtp = {
      code: newOtp,
      expiresAt: Date.now() + 30 * 1000
    }

    const emailSent = await sendVerificationEmail(email, newOtp);

    if (emailSent) {
      console.log('Resent OTP:', newOtp);
      return res.status(200).json({ success: true });
    } else {
      return res.status(500).json({ success: false, error: "Failed to resend OTP" });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};



const loadlogin = async (req, res) => {
  try {


    if (!req.session.user) {
      return res.render('user/login', { error: null })
    } else {
    }

  } catch (error) {

    res.redirect('/error404')

  }
}

const login = async (req, res) => {
  try {

    const { email, password } = req.body;
    const finduser = await User.findOne({ email: email })
    if (!email || !password) {
      return res.render("user/login", { error: "all feilds are required" })
    }
    if (!finduser) {
      return res.render("user/login", { error: "user not found" })
    } if (finduser.isBlocked) {
      return res.render('user/login', { error: "user is blocked by admin" })
    }

    const passwordmatch = await bcrypt.compare(password, finduser.password)
    if (!passwordmatch) {
      return res.render('user/login', { error: "incorrect password" })
    }

    req.session.user = finduser
    res.redirect('/user/')

  } catch (error) {

    console.log('loggin error', error);
    res.render('user/login', { error: "login failed , please try again later" })

  }
}

const forgotPasswordPage = async (req, res) => {
  try {
    res.render('user/forgotpassword', { error: null });
  } catch (error) {
    console.error('Error loading forgot password page:', error);
    res.redirect('/user/login');
  }
};

const handleForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render('user/forgotpassword', { error: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.render('user/forgotpassword', { error: 'No account found with this email' });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render('user/forgotpassword', { error: 'Failed to send OTP. Please try again.' });
    }

    req.session.verifiedEmail = email;
    req.session.secondOtp = otp;
    req.session.otpGeneratedAt = Date.now();

    console.log('🔐 Forgot password OTP sent:', otp);
    res.render('user/forgotpasswordotp', { error: null });

  } catch (error) {
    console.error('Error in handleForgotPassword:', error);
    res.render('user/forgotpassword', { error: 'An error occurred. Please try again.' });
  }
};

const forgotPasswordOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ success: false, error: 'OTP is required.' });
    }

    const { verifiedEmail, secondOtp, otpGeneratedAt } = req.session;
    if (!verifiedEmail || !secondOtp || !otpGeneratedAt) {
      return res.status(400).json({ success: false, error: 'Session expired. Please start over.' });
    }

    const currentTime = Date.now();
    const timeDifference = (currentTime - otpGeneratedAt) / 1000;

    if (timeDifference > 30) {
      req.session.secondOtp = null;
      req.session.otpGeneratedAt = null;
      return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
    }

    if (otp == secondOtp) {
      req.session.secondOtp = null;
      req.session.otpGeneratedAt = null;
      return res.status(200).json({ success: true, redirect: '/user/changepassword' });
    } else {
      return res.status(400).json({ success: false, error: 'Incorrect OTP. Please try again.' });
    }

  } catch (error) {
    console.error('Error verifying forgot password OTP:', error);
    return res.status(500).json({ success: false, error: 'An error occurred during OTP verification.' });
  }
};

const resendForgotOtp = async (req, res) => {
  try {
    const email = req.session.verifiedEmail;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Session expired. Please start over.' });
    }

    const newOtp = generateOtp();
    const emailSent = await sendVerificationEmail(email, newOtp);

    if (!emailSent) {
      return res.status(500).json({ success: false, error: 'Failed to resend OTP. Please try again.' });
    }

    req.session.secondOtp = newOtp;
    req.session.otpGeneratedAt = Date.now();

    console.log('Resent forgot password OTP:', newOtp);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error resending forgot password OTP:', error);
    return res.status(500).json({ success: false, error: 'An error occurred while resending OTP.' });
  }
};


const loadChangePassword = async (req, res) => {
  try {
    if (!req.session.verifiedEmail) {
      return res.redirect('/user/forgotpassword');
    }
    res.render('user/changepassword', { error: null });
  } catch (error) {
    console.error('Error loading change password page:', error);
    res.redirect('/user/login');
  }
}

const changePassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.verifiedEmail;

    if (!email) {
      return res.render('user/changepassword', { error: 'Session expired. Please start over.' });
    }

    if (!password || !confirmPassword) {
      return res.render('user/changepassword', { error: 'All fields are required.' });
    }

    if (password !== confirmPassword) {
      return res.render('user/changepassword', { error: 'Passwords do not match.' });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.render('user/changepassword', {
        error: 'Password must be at least 6 characters and include a number.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    req.session.verifiedEmail = null;
    req.session.secondOtp = null;

    res.redirect('/user/login');
  } catch (error) {
    console.error('Error changing password:', error);
    res.render('user/changepassword', { error: 'An error occurred. Please try again.' });
  }
};


const loadProducts = async (req, res) => {
  try {
    const { search, category, brand, minPrice, maxPrice, sort, page = 1 } = req.query;
    const limit = 12;

    let query = { isListed: true };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category) {
      query.category = category;
    }
    if (brand) {
      query.brand = brand;
    }
    if (minPrice || maxPrice) {
      query.salePrice = {};
      if (minPrice) query.salePrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.salePrice.$lte = parseFloat(maxPrice);
    }

    let sortOption = {};
    if (sort === 'latest') sortOption.createdAt = -1;
    else if (sort === 'price-asc') sortOption.salePrice = 1;
    else if (sort === 'price-desc') sortOption.salePrice = -1;
    else if (sort === 'rating') sortOption.rating = -1;

    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isListed: true });
    let user = null;
    if (req.session.user && req.session.user._id) {
      user = await User.findById(req.session.user._id);
      console.log('Session userId in loadProducts:', req.session.user._id);
    } else {
      console.log('No valid session userId in loadProducts');
    }

    let wishlist = [];
    if (user) {
      const wishlistDoc = await Wishlist.findOne({ userId: user._id }).populate({
        path: 'products.productId',
        match: { isListed: true, status: 'available' }
      });
      wishlist = wishlistDoc
        ? wishlistDoc.products
          .filter(item => item.productId)
          .map(item => item.productId._id.toString())
        : [];
      console.log('Wishlist product IDs in loadProducts:', wishlist);
    }

    const totalProducts = await Product.countDocuments(query);
    let products = await Product.find(query)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('brand')
      .populate('category');
    products = products.filter(p => p.brand?.isListed && p.category?.isListed && p.isListed && p.status === 'available');

    let cartCount = 0;
    if (user) {
      const cart = await Cart.findOne({ user: user._id }).populate('items.product');
      if (cart) {
        cartCount = cart.items.reduce((sum, item) => {
          if (item.product && item.product.isListed && item.product.status === 'available') {
            return sum + item.quantity;
          }
          return sum;
        }, 0);
      }
    }

    return res.render('user/products', {
      user,
      cartCount,
      products,
      categories,
      brands,
      wishlist,
      search: search || '',
      category: category || '',
      brandId: brand || '',
      minPrice: minPrice || '',
      maxPrice: maxPrice || '',
      sort: sort || '',
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalProducts / limit),
      hasMore: parseInt(page) * limit < totalProducts
    });
  } catch (error) {
    console.error('Error loading products page:', error);
    res.status(500).render('user/error', {
      message: 'Server error',
      user: req.session.user || null,
      cartCount: 0,
      search: req.query.search || ''
    });
  }
};

const loadProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user?._id;

    const product = await Product.findById(productId).populate('brand').populate('category');
    if (!product || product.isDeleted || product.isBlocked || product.status !== 'available') {
      return res.status(404).render('user/error', {
        message: 'Product not found or unavailable',
        user: req.session.user || null,
        search: req.query.search || '',
        cartCount: 0,
      });
    }

    let cartCount = 0;
    let total = 0;
    let cart = null;
    if (userId) {
      cart = await Cart.findOne({ user: userId }).populate('items.product');
      if (cart) {
        cart.items = cart.items.filter(item => {
          if (
            item.product &&
            !item.product.isDeleted &&
            !item.product.isBlocked &&
            item.product.status === 'available'
          ) {
            total += item.product.salePrice * item.quantity;
            return true;
          }
          return false;
        });
        await cart.save();
        cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      }
    }

    let wishlist = [];
    if (userId) {
      const wishlistDoc = await Wishlist.findOne({ userId }).populate({
        path: 'products.productId',
        match: { isDeleted: false, isBlocked: false, status: 'available' },
      });
      wishlist = wishlistDoc
        ? wishlistDoc.products
          .filter(item => item.productId)
          .map(item => item.productId._id.toString())
        : [];
    }

    const reviews = await Review.find({ product: productId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    const averageRating = reviews.length
      ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
      : 0;

    req.session.recentlyViewed = req.session.recentlyViewed || [];
    if (!req.session.recentlyViewed.includes(productId)) {
      req.session.recentlyViewed.push(productId);
      if (req.session.recentlyViewed.length > 10) {
        req.session.recentlyViewed.shift();
      }
    }

    const validRecentlyViewedIds = [];
    for (const id of req.session.recentlyViewed) {
      try {
        const prod = await Product.findOne({
          _id: id,
          isDeleted: false,
          isBlocked: false,
          status: 'available',
        });
        if (prod && id !== productId) {
          validRecentlyViewedIds.push(id);
        }
      } catch (err) {
        console.log(`Error validating product ID ${id}:`, err.message);
      }
    }
    req.session.recentlyViewed = validRecentlyViewedIds;

    const recentlyViewed = await Product.find({
      _id: { $in: validRecentlyViewedIds },
      isDeleted: false,
      isBlocked: false,
      status: 'available',
    })
      .populate('brand')
      .limit(6);

    const youMayAlsoLike = await Product.find({
      category: product.category?._id,
      _id: { $ne: productId, $nin: validRecentlyViewedIds },
      isDeleted: false,
      isBlocked: false,
      status: 'available',
    })
      .populate('brand')
      .limit(6);

    res.render('user/productdetails', {
      product,
      cart,
      total,
      youMayAlsoLike,
      recentlyViewed,
      user: req.session.user || null,
      search: req.query.search || '',
      cartCount,
      wishlist,
      reviews,
      averageRating,
    });
  } catch (error) {
    console.error('Error loading product details:', error);
    res.status(500).render('user/error', {
      message: 'An error occurred while loading the product details.',
      user: req.session.user || null,
      search: req.query.search || '',
      cartCount: 0,
    });
  }
};


const loadlogout = async (req, res) => {
  try {
    req.session.user = null;
    res.redirect('/');
  } catch (error) {
    console.error('Error during logout process:', error);
    res.status(500).send('An error during logging out.');
  }
};



const loadRefferal = async (req, res) => {
  try {
    console.log('Entering loadRefferal controller');

    const userId = req.session.user._id;
    console.log('User ID:', userId);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('Invalid user ID format');
      return res.status(400).send('Invalid user ID');
    }

    console.log('Fetching user from database');
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found, redirecting to login');
      return res.redirect('/login');
    }

    console.log('User found:', user.email);

    console.log('Rendering referral.ejs');
    res.render('user/referralCode', {
      user,
      referralCode: user.referralCode || 'N/A',
    });

  } catch (error) {
    console.error('Error loading referral page:', error.message);
    res.status(500).send('Internal server error');
  }
};

module.exports = {
  loadlanding,
  pageNotFound,
  loadSignUp,
  signup,
  verifyOtp,
  resendOtp,
  loadlogin,
  login,
  forgotPasswordPage,
  handleForgotPassword,
  forgotPasswordOtp,
  loadChangePassword,
  changePassword,
  loadProducts,
  loadProductDetails,
  loadlogout,
  resendForgotOtp,
  generateOtp,
  sendVerificationEmail,
  loadRefferal
}