const express = require('express');
const router = express.Router();
const userController = require("../../Controller/user/userController");
const cartController = require("../../Controller/user/cartController");
const UserProfileController = require("../../Controller/user/UserProfileController");
const wishlistController = require("../../Controller/user/wishlistController");
const addressController = require("../../Controller/user/addressController");
const checkoutController = require("../../Controller/user/checkoutController");
const OrderController = require("../../Controller/user/orderController");
const walletController = require("../../Controller/user/walletController");
const applyCouponController = require('../../Controller/user/applyCouponController')
const ReviewController = require('../../Controller/user/reviewController')
const passport = require('passport');
const razorpayController = require('../../Controller/user/razorpayController')
const { userAuth } = require("../../MiddleWares/auth");

router.get('/', userController.loadlanding);
router.get('/sign-up', userController.loadSignUp);
router.post('/sign-up', userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.get('/error404', userController.pageNotFound);
router.post('/resend-otp', userController.resendOtp);
router.get('/login', userController.loadlogin);
router.post('/login', userController.login);
router.get('/forgotpassword', userController.forgotPasswordPage);
router.post('/forgotpassword', userController.handleForgotPassword);
router.post('/forgotpasswordotp', userController.forgotPasswordOtp);
router.post('/resend-forgot-otp', userController.resendForgotOtp);
router.get('/changepassword', userController.loadChangePassword);
router.post('/changepassword', userController.changePassword);
router.get('/logout', userController.loadlogout);
router.get('/products', userController.loadProducts);
router.get('/products/:id', userAuth, userController.loadProductDetails);
router.get('/cart', userAuth, cartController.loadcart);
router.post('/add-to-cart', userAuth, cartController.addToCart);
router.post('/addtocart', userAuth, wishlistController.addToCart)
router.post('/update-cart', userAuth, cartController.updateCart);
router.post('/remove-from-cart', userAuth, cartController.removeFromCart);
router.post('/clear-cart', userAuth, cartController.clearCart);
router.get("/account", userAuth, UserProfileController.loadAccount);
router.post("/edit-profile", userAuth, UserProfileController.updateAcount);
router.post("/verify-email-otp", userAuth, UserProfileController.verificationotp);
router.get("/wishlist", userAuth, wishlistController.loadwishlist);
router.get("/sidewishlist", userAuth, wishlistController.loadsidewishlist);
router.post("/wishlist/add", userAuth, wishlistController.addTOWishlist);
router.post("/remove-from-wishlist", userAuth, wishlistController.removeWishlist);
router.get("/address", userAuth, addressController.loadAddress);
router.get('/address/:addressId', userAuth, addressController.getAddress);
router.post("/address", userAuth, addressController.createAddress);
router.post('/address/edit/:addressId', userAuth, addressController.editAddress);
router.post('/address/delete/:addressId', userAuth, addressController.deleteAddress);
router.get("/checkout", userAuth, checkoutController.loadCheckout);
router.post("/order/place", userAuth, checkoutController.placeOrder);
router.get("/order/success", userAuth, checkoutController.loadSuccess);
router.get('/order-failed', userAuth, checkoutController.loadFailed)
router.get("/orders", userAuth, UserProfileController.loadOrders);
router.get("/orders/:id", userAuth, OrderController.viewOrderDetail);
router.get("/orders/:id", userAuth, OrderController.getOrder);
router.post("/orders/cancel/:orderId", userAuth, OrderController.cancelOrder);
router.post('/orders/return/:orderId', userAuth, OrderController.returnEntireOrder);
router.get('/orders/invoice/:orderId', userAuth, OrderController.downloadInvoice)
router.post('/order/create-razorpay-order', userAuth, razorpayController.createRazorpayOrder);
router.post('/order/verify-payment', userAuth, razorpayController.verifyPayment);
router.post('/apply-coupon', userAuth, applyCouponController.applyCoupon);
router.post('/remove-coupon', userAuth, applyCouponController.removeCoupon);


router.post('/request-item-action/:orderId/:productId', userAuth, OrderController.requestItemAction);
router.get("/wallet", userAuth, walletController.loadWallet);
router.post('/wallet/add', userAuth, walletController.addToWallet);
router.post("/wallet/withdraw", userAuth, walletController.withdraw);
router.get('/newpassword', userAuth, walletController.loadnewpassword);
router.post("/verify-old-password", userAuth, walletController.verifyOldpassword);
router.post("/change-password", userAuth, walletController.newPassword);
router.get('/about', UserProfileController.loadabout);
router.get('/contact', UserProfileController.loadcontact);
router.get('/referral', userAuth, userController.loadRefferal)
router.get('/coupons', userAuth, applyCouponController.loadAvailableCoupons)
router.post('/reviews', userAuth, ReviewController.submitReview)
router.put('/reviews/:reviewId', userAuth, ReviewController.updateReview)
router.delete('/reviews/:reviewId', userAuth, ReviewController.deleteReview)
router.post('/orders/retry-payment/:id', userAuth, razorpayController.retryPayment);


router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    req.session.user = req.user;
    res.redirect('/');
});

module.exports = router;
