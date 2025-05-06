const User = require('../../Model/userSchema')
const Product = require("../../Model/productSchema")
const Category = require("../../Model/categorySchema")
const Brand = require("../../Model/brandschema")
const Cart = require("../../Model/cartSchema")
const nodemailer = require('nodemailer')
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
        const user = await User.find({ isBlocked: false })
        if (!user) {
            res.redirect("/user/login")
        }
        const newArrivals = await Product.find({ status: "available" })
            .sort({ createdAt: -1 })
            .limit(4)
            .populate('brand')
            .populate('category');
        const trendingProducts = await Product.find({ status: "available" })
            .sort({ createdAt: 1 })
            .limit(4)
            .populate('brand')
            .populate('category');
        const exploreProducts = await Product.find({ status: "available" })
            .populate('brand')
            .populate('category')
            .limit(8);

        let cartCount = 0;
        if (req.session.user) {
            const cart = await Cart.findOne({ user: req.session.user._id });
            if (cart) {
                cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            }
        }

        return res.render('user/landingPage', {
            user: req.session.user || null,
            cartCount: cartCount,
            newArrivals,
            trendingProducts,
            exploreProducts,
            categories,
            brands,
            search: req.query.search,
        });
    } catch (error) {
        console.log('user homepage not found', error);
        res.status(500).send('server error');
    }
};

const loadSignUp = async (req, res) => {
    try {
        return res.render('user/signUp', { error: null });

    } catch (error) {
        res.redirect('/user/error404')
    }
}


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
            from: `"Timzo Support" <${process.env.NODEMAILER_EMAIL}>`,
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
        const { fullname, email, mobile, password, conformPassword } = req.body;

        if (password !== conformPassword) {
            return res.render('/signUp', { error: "Passwords do not match" });
        }

        // if(typeof(mobile)!==Number){
        //     return res.render('user/signUp', { error: "enter a valid number" })
        // }

        if (!fullname || !email || !mobile || !password || !conformPassword) {
            return res.render('user/signUp', { error: "All fields are required" });
        }

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.render('user/signUp', {
                error: "Password must be at least 6 characters and include a number",
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('user/signUp', { error: "Email already registered" });
        }

        const otp = generateOtp()
        const emailsent = await sendVerificationEmail(email, otp)
        console.log(emailsent)
        if (!emailsent) {
            return res.json('email error')
        }

        req.session.userOtp = otp;
        req.session.userData = { fullname, email, mobile, password }

        res.render('user/verifyOtp', { error: null })
        console.log('otp sented ', otp);

    } catch (error) {
        console.error('Error during signup:', error.message);
        res.status(500).redirect('/user/error404')
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

        console.log(otp);

        if (otp == req.session.userOtp) {
            const user = req.session.userData
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                fullname: user.fullname,
                email: user.email,
                password: passwordHash,
                mobile: user.mobile
            })
            await saveUserData.save()
            req.session.user = saveUserData

            res.redirect("/user/");
        } else {
            res.render("user/verifyOtp", {
                error: "Incorrect OTP. Please try again."
            });
        }
    } catch (error) {

        console.error("error varifying otp", error)
        res.status(500).json({ success: false, error: 'an error occured' })

    }
}

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, error: "Session expired" });
        }

        const newOtp = generateOtp();
        req.session.userOtp = newOtp;

        const emailSent = await sendVerificationEmail(email, newOtp);

        if (emailSent) {
            console.log('resend otp ', newOtp);

            res.status(200).json({ success: true });
        } else {
            res.json({ success: false, error: "Failed to resend OTP" });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).json({ success: false, error: "Server error" }).res.redirect('/error404')
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
        const finduser = await User.findOne({ isAdmin: 0, email: email })

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
        res.render('user/forgotpassword', { error: null, email: null, message: null })
    } catch (error) {
        console.log('forgot password got error', error);

    }
}

const handleForgotPassword = async (req, res) => {
    try {

        const { email } = req.body;
        const user = await User.findOne({ email })

        if (!user) {
            return res.render('user/forgotpassword', { email: null, message: 'something wrong' })
        }
        req.session.verifiedEmail = email
        const otp = generateOtp()
        req.session.secondOtp = otp
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: `"Timzo Support" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: "Reset your Timzo password",
            text: `Your OTP is ${otp}`,
        });
        console.log(otp);


        res.render("user/forgotpasswordotp", { email: null, error: null });



    } catch (error) {

    }
}


const forgotpasswordotp = async (req, res) => {
    try {
        const { email, otp } = req.body
        if (otp == req.session.secondOtp) {

            res.redirect("/user/changepassword")
        } else {

            return res.render('user/forgotpasswordotp', { email, error: 'Invalid OTP' });


        }


    } catch (error) {

    }
}

const loadchangepassword = async (req, res) => {
    try {
        return res.render('user/changepassword', { error: null })
    } catch (error) {
        res.redirect('/user/login')
    }
}

const changepassword = async (req, res) => {
    try {
        const { password } = req.body;
        const email = req.session.verifiedEmail;


        const hashedPassword = await bcrypt.hash(password, 10)
        await User.findOneAndUpdate({ email }, { password: hashedPassword });
        req.session.verifiedEmail = null;
        req.session.secondOtp = null;
        res.redirect('/user/login');

    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
        console.log(req.body);

    }
}
const loadProducts = async (req, res) => {
    try {
        const { search, category, brand, minPrice, maxPrice, sort } = req.query;
        const query = { status: 'available' };

        // Search by product name or brand name
        if (search) {
            const brandIds = await Brand.find({
                name: { $regex: new RegExp('.*' + search + '.*', 'i') }
            }).select('_id');
            query.$or = [
                { name: { $regex: new RegExp('.*' + search + '.*', 'i') } },
                { brand: { $in: brandIds.map(id => id._id) } }
            ];
        }

        // Filter by category and brand
        if (category) query.category = category;
        if (brand) query.brand = brand;

        // Filter by price range
        if (minPrice || maxPrice) {
            query.salePrice = {};
            if (minPrice) query.salePrice.$gte = parseFloat(minPrice);
            if (maxPrice) query.salePrice.$lte = parseFloat(maxPrice);
        }

        // Sort options
        const sortOptions = {
            latest: { createdAt: -1 },
            'price-asc': { salePrice: 1 },
            'price-desc': { salePrice: -1 },
            rating: { rating: -1 }
        };

        // Fetch products
        const products = await Product.find(query)
            .sort(sortOptions[sort] || { createdAt: -1 })
            .populate('brand')
            .populate('category');

        // Fetch categories and brands for filters
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isListed: true });

        // Calculate cart count if user is logged in
        let cartCount = 0;
        if (req.session.user) {
            const cart = await Cart.findOne({ user: req.session.user._id });
            if (cart) {
                cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            }
        }

        // Render the products page
        res.render('user/products', {
            user: req.session.user || null,
            cartCount,
            newArrivals: products.slice(0, 8),
            trendingProducts: products.slice(8, 16),
            exploreProducts: products.slice(16, 28),
            categories,
            brands,
            search: search || '',
            category: category || '',
            brandId: brand || '',
            minPrice: minPrice || '',
            maxPrice: maxPrice || '',
            sort: sort || ''
        });
    } catch (error) {
        console.error('Error loading products:', error);
        res.status(500).render('user/error', { error: 'Failed to load products' });
    }
};

const loadProductDetails = async (req, res) => {
    try {
      const productId = req.params.id;
      const userId = req.session.user?._id;
  
      // Fetch product
      const product = await Product.findById(productId).populate('brand');
      if (!product || product.isDeleted || product.isBlocked || product.status !== 'available') {
        return res.status(404).render('user/error', {
          message: 'Product not found or unavailable',
          user: req.session.user || null,
          search: req.query.search || '',
          cartCount: 0
        });
      }
  
      // Initialize variables
      let cartCount = 0;
      let total = 0;
      let cart = null;
  
      // Fetch cart if user is logged in
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
  
      // Initialize session for recently viewed
      req.session.recentlyViewed = req.session.recentlyViewed || [];
  
      // Add current product to recently viewed (exclude duplicates)
      if (!req.session.recentlyViewed.includes(productId)) {
        req.session.recentlyViewed.push(productId);
        if (req.session.recentlyViewed.length > 10) {
          req.session.recentlyViewed.shift(); // Keep last 10
        }
      }
  
      // Debug session
      console.log('Session Recently Viewed:', req.session.recentlyViewed);
  
      // Validate recently viewed IDs
      const validRecentlyViewedIds = [];
      for (const id of req.session.recentlyViewed) {
        try {
          const prod = await Product.findOne({
            _id: id,
            isDeleted: false,
            isBlocked: false,
            status: 'available'
          });
          if (prod && id !== productId) {
            validRecentlyViewedIds.push(id);
          } else {
            console.log(`Invalid or unavailable product ID in recently viewed: ${id}`);
          }
        } catch (err) {
          console.log(`Error validating product ID ${id}:`, err.message);
        }
      }
  
      // Update session with valid IDs
      req.session.recentlyViewed = validRecentlyViewedIds;
  
      // Fetch recently viewed products
      const recentlyViewed = await Product.find({
        _id: { $in: validRecentlyViewedIds },
        isDeleted: false,
        isBlocked: false,
        status: 'available'
      }).populate('brand').limit(6);
  
      // Fetch "You May Also Like" products
      const youMayAlsoLike = await Product.find({
        $or: [
          { category: product.category || { $exists: true } },
          { brand: product.brand?._id }
        ],
        _id: { $ne: productId, $nin: validRecentlyViewedIds },
        isDeleted: false,
        isBlocked: false,
        status: 'available'
      }).populate('brand').limit(6);
  
  
      // Render product details page
      res.render('user/productdetails', {
        product,
        cart,
        total,
        youMayAlsoLike,
        recentlyViewed,
        user: req.session.user || null,
        search: req.query.search || '',
        cartCount
      });
    } catch (error) {
      console.error('Error loading product details:', error);
      res.status(500).render('user/error', {
        message: 'An error occurred while loading the product details.',
        user: req.session.user || null,
        search: req.query.search || '',
        cartCount: 0
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
    forgotpasswordotp,
    loadchangepassword,
    changepassword,
    loadProducts,
    loadProductDetails,
    loadlogout
}