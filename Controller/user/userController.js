const User = require ('../../Model/userSchema')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const bcrypt = require("bcrypt")

const pageNotFound = async (req,res)=>{
    try {
        res.render('user/error404')
    } catch (error) {
         res.redirect('/user/error404')      
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
            newArrivals,
            trendingProducts,
            exploreProducts
        });

    } catch (error) {
        console.log('user homepage not found', error);
        res.status(500).send('server error');
    }
};

const loadSignUp = async (req,res)=>{
    try {
        return res.render('user/signUp', { error: null });

    } catch (error) {
        res.redirect('/user/error404')
    }
}


function generateOtp(){
    return Math.floor(100000 + Math.random() * 900000);
 }

async function sendVerificationEmail(email,otp){
    try {
        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
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
          
          

        return info.accepted.length >0


    } catch (error) {
        console.error("ERROR SENDING EMAIL",error);
        return false    
        
    }
}




const signup = async (req, res) => {
    try {
        const { fullname, email, mobile, password, conformPassword } = req.body;

        if (password !== conformPassword) {
            return res.render('user/signUp', { error: "Passwords do not match" });
        }

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
        const emailsent = await sendVerificationEmail(email,otp)

        if(!emailsent){
            return res.json('email error')
        }

        req.session.userOtp = otp;
        req.session.userData = {fullname, email, mobile, password}

        res.render('user/verifyOtp',{error:null})
        console.log('otp sented ',otp);

    } catch (error) {
        console.error('❌ Error during signup:', error.message);
        res.status(500).redirect('/user/error404')
    }
};

const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)

        return passwordHash

    } catch (error) {
        console.error("Password hash error:", error);
        throw error;
        
    }
}

const verifyOtp = async (req,res)=>{
    try {
        const {otp} = req.body;

        console.log(otp);
        
        if(otp==req.session.userOtp){
            const user = req.session.userData
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                fullname:user.fullname,
                email:user.email,
                password:passwordHash,
                mobile:user.mobile
            })
            await saveUserData.save()
            req.session.user = saveUserData._id;

            res.redirect("/user/home");
        }else{
            res.render("user/verifyOtp", {
                error: "Incorrect OTP. Please try again."
              });
        }
    } catch (error) {

        console.error("error varifying otp",error)
        res.status(500).json({success:false , error:'an error occured'})
        
    }
}

const resendOtp = async (req, res) => {
    try {
      const {email} = req.session.userData;
      if (!email  ) {
        return res.status(400).json({ success: false, error: "Session expired" });
      }
  
      const newOtp = generateOtp();
      req.session.userOtp = newOtp;
  
      const emailSent = await sendVerificationEmail(email, newOtp);
  
      if (emailSent) {
        console.log('resend otp ',newOtp);
        
        res.status(200).json({ success: true });
      } else {
        res.json({ success: false, error: "Failed to resend OTP" });
      }
    } catch (error) {
      console.error("Error resending OTP", error);
      res.status(500).json({ success: false, error: "Server error" });
    }
  };
  

const loadhome = async (req,res)=>{
    try {
        res.render('user/home')
    } catch (error) {
        
    }
}

module.exports = {
    loadlanding,
    pageNotFound,
    loadSignUp,
    signup,
    verifyOtp,
    loadhome,
    resendOtp
    
}