const User = require("../../Model/userSchema")
const Cart = require("../../Model/cartSchema")
const Order = require("../../Model/orderSchema")
const OTP = require("../../Controller/user/userController")

const loadAccount = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/user/login');
        }
        const user = await User.findById(req.session.user._id);
        if (!user || user.isBlocked) {
            req.session.user = null;
            return res.redirect('/user/login');
        }

        let cartCount = 0;
        const cart = await Cart.findOne({ user: req.session.user._id });
        if (cart) {
            cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        }

        res.render('user/userProfile', {
            user: req.session.user,
            cartCount,
            currentPage: 'profile'
        });
    } catch (error) {
        console.error('Error loading account:', error);
        res.redirect('/error404');
    }
};

const loadabout = async(req,res)=>{
    try {
        res.render("user/aboutUs")
    } catch (error) {
        
    }
}

const loadcontact = async(req,res)=>{
    try {
        res.render("user/contact")
    } catch (error) {
        
    }
}

const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).render("user/login", {
                message: "Please log in to view your orders",
                user: null
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).redirect("/error404");
        }

        const orders = await Order.find({ user: userId })
            .sort({ orderDate: -1 })
            .populate("items.productId", "price regularPrice name salePrice");

        orders.forEach(order => {
            // Filter valid items (not cancelled)
            const validItems = order.items.filter(item => item.status !== 'Cancelled');

            // Calculate subtotal using itemTotal
            const subtotal = validItems.reduce((sum, item) => {
                return sum + (item.itemTotal || 0);
            }, 0);

            // Calculate item-level discount
            const itemDiscount = validItems.reduce((sum, item) => {
                const regular = item.productId?.regularPrice ?? item.price ?? 0;
                const actual = item.productId?.salePrice ?? item.price ?? 0;
                const perUnitDiscount = Math.max(0, regular - actual);
                return sum + (perUnitDiscount * item.quantity);
            }, 0);

            const couponDiscount = order.coupon?.discount || 0;
            const totalDiscount = itemDiscount + couponDiscount;

            const tax = subtotal * 0.1;
            const shippingFee = order.shippingFee ?? 10;

            // Store detailed breakdown (used for display)
            order.calculated = {
                subtotal,
                itemDiscount,
                couponDiscount,
                totalDiscount,
                tax,
                shippingFee,
                newTotal: subtotal + tax + shippingFee - totalDiscount
            };

            // Keep the original order.totalAmount (from DB) as-is
        });

        res.render("user/myOrder", {
            user,
            orders
        });

    } catch (error) {
        console.error("Error loading orders:", error);
        res.status(500).render("error", {
            message: "Internal Server Error"
        });
    }
};




const updateAcount = async(req,res)=>{
    try {
         const userId = req.session.user._id
         const {fullname , email , mobile} = req.body
         if(!fullname || !email){
            return res.status(400).json({success:false,messaeg:"full name and email requird"})
         }
         const user = await User.findById(userId)
         if(!user){
            return res.status(400).json({success:false,message:"user not founfd"})
         }
         console.log("im the user",user)
         if(user.email !==email){
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email is already in use' });
            }
            const otp =  OTP.generateOtp()
             console.log(`type email otp is  ${otp}`)
            await OTP.sendVerificationEmail(email,otp)
            req.session.otp = otp
            req.session.newemail = email
            req.session.newdetails = {fullname,mobile}
            

            return res.status(200).json({
                success: false,
                message: 'OTP sent to new email for verification',
                requiresOtp: true,
            });
        
         }

         user.fullname = fullname;
         user.mobile = mobile;
         await user.save()
         return res.status(200).json({success:true,message:"profile updated"})
    } catch (error) {
        console.log("update error",error)
    return res.status(400).json({success:false,message:"internal serval error"})
    }
}

const verificationotp = async(req,res)=>{
    try {
        const {otp} = req.body
        const sessionOtp = req.session.otp;
        const newEmail = req.session.newemail;
        const newDetails = req.session.newdetails;

        console.log(`type email otp is  ${otp}`)


    if (!otp || !sessionOtp || !newEmail ) {
      return res.status(400).json({ success: false, message: "OTP verification data missing" });
    }

    if (otp != sessionOtp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const user = await User.findById(req.session.user._id)
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.fullname = newDetails.fullname;
    user.mobile = newDetails.mobile;
    user.email = newEmail;

    await user.save();
    
    delete req.session.otp;
    delete req.session.otpExpiry;
    delete req.session.newEmail;
    delete req.session.newDetails;

    return res.status(200).json({ success: true, message: "Email and profile updated" });

    } catch (error) {
         console.error("OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

module.exports={
    loadAccount,
    loadabout,
    loadcontact,
    loadOrders,
    updateAcount,
    verificationotp
}