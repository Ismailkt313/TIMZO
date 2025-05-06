const express = require('express');
const router = express.Router();
const userController = require("../../Controller/user/userController");
const cartController = require("../../Controller/user/cartController")
const UserProfileController = require("../../Controller/user/UserProfileController")
const wishlistController = require("../../Controller/user/wishlistController")

const passport = require('passport');
const {userAuth,adminAuth}=require("../../MiddleWares/auth")

router.get('/',userController.loadlanding);
router.get('/sign-up',userController.loadSignUp)
router.post('/sign-up',userController.signup)
router.post('/verify-otp',userController.verifyOtp) 
router.get('/error404',userController.pageNotFound)
router.post('/resend-otp', userController.resendOtp);
router.get('/login',userController.loadlogin)
router.post('/login',userController.login)
router.get('/forgotpassword', userController.forgotPasswordPage);
router.post('/forgotpassword', userController.handleForgotPassword); 
// router.post('/resetpassword', userController.changepassword);
router.get('/changepassword',userController.loadchangepassword)
router.post('/changepassword',userController.changepassword)
router.get('/logout',userController.loadlogout)
router.get('/products',userAuth,userController.loadProducts);
router.get('/products/:id',userAuth, userController.loadProductDetails);
router.get('/cart',userAuth,cartController.loadcart)
router.post('/add-to-cart', userAuth, cartController.addToCart);
router.post('/update-cart', userAuth, cartController.updateCart);
router.post('/remove-from-cart', userAuth, cartController.removeFromCart);
router.post('/clear-cart', userAuth, cartController.clearCart);
router.get("/account",userAuth,UserProfileController.loadAccount)
router.get("/wishlist",userAuth,wishlistController.loadwishlist)
router.post("/wishlist/add",userAuth,wishlistController.addTOWishlist)
router.post("/remove-from-wishlist",userAuth,wishlistController.removeWishlist)
   
  

router.get('/auth/google',passport.authenticate('google', { scope: ['profile', 'email'] }));
  
  router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }),(req, res) => {
    req.session.user = req.user
    user = req.session.user
      res.redirect('/');
    }
  ); 
module.exports = router;
 

