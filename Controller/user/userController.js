const User = require('../../Model/userSchema')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const bcrypt = require("bcrypt")

const pageNotFound = async (req, res) => {
    try {
        res.render('error404')
    } catch (error) {
        res.redirect('/error404')      ////enkk
    }
}

const loadlanding = async (req, res) => {
    try {

        const newArrivals = [
            {
                image: "/images/watch1.jpg",
                title: "Classic Watch",
                rating: 4,
                price: 129.99
            },
            {
                image: "/images/watch2.jpg",
                title: "Modern Watch",
                rating: 5,
                price: 199.99
            }
        ];

        const trendingProducts = [
            {
                image: "/images/watch3.jpg",
                title: "Trending Watch A",
                rating: 5,
                price: 249.99 
            },
            {
                image: "/images/watch4.jpg",
                title: "Trending Watch B",
                rating: 4,
                price: 179.99
            }
        ];

        const exploreProducts = [
            {
                image: "/images/watch5.jpg",
                title: "Explorer Watch A",
                rating: 3,
                price: 149.99
            },
            {
                image: "/images/watch6.jpg",
                title: "Explorer Watch B",
                rating: 5,
                price: 229.99
            }
        ];

        return res.render('user/landingPage', {
            user: req.session.user || null,
            newArrivals,
            trendingProducts,
            exploreProducts
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
    return Math.floor(100000 + Math.random() * 900000);    //////enk
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
        });



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

        if (!emailsent) {
            return res.json('email error')
        }

        req.session.userOtp = otp;
        req.session.userData = { fullname, email, mobile, password }

        res.render('user/verifyOtp', { error: null })
        console.log('otp sented ', otp);

    } catch (error) {
        console.error('❌ Error during signup:', error.message);
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
            req.session.user = saveUserData._id;

            res.redirect("/user/home");
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
            //res.redirect('/user/home')
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

        req.session.user = finduser._id
        res.redirect('/user/home')

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
        console.log(hashedPassword);
        req.session.verifiedEmail = null;
        req.session.secondOtp = null;
        res.redirect('/user/login');

    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
        console.log(req.body);

    }
}


const loadhome = async (req, res) => {
    try {

        const newArrivals = [
            {
                image: "/images/watch1.jpg",
                title: "Classic Watch",
                rating: 4,
                price: 129.99
            },
            {
                image: "/images/watch2.jpg",
                title: "Modern Watch",
                rating: 5,
                price: 199.99
            }
        ];

        const trendingProducts = [
            {
                image: "/images/watch3.jpg",
                title: "Trending Watch A",
                rating: 5,
                price: 249.99
            },
            {
                image: "/images/watch4.jpg",
                title: "Trending Watch B",
                rating: 4,
                price: 179.99
            }
        ];

        const exploreProducts = [
            {
                image: "/images/watch5.jpg",
                title: "Explorer Watch A",
                rating: 3,
                price: 149.99
            },
            {
                image: "/images/watch6.jpg",
                title: "Explorer Watch B",
                rating: 5,
                price: 229.99
            }
        ];

        return res.render('user/landingPage', {
            user: req.session.user,
            newArrivals,
            trendingProducts,
            exploreProducts
        });

    } catch (error) {
        console.log('user homepage not found', error);
        res.status(500).send('server error');
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
    loadhome,
    loadlogout
}