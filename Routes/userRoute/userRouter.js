const express = require('express');
const router = express.Router();
const userController = require("../../Controller/user/userController");
const passport = require('passport');

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
router.get('/home',userController.loadhome)
router.get('/logout',userController.loadlogout)
 
 
 

router.get('/auth/google', passport.authenticate('google', {scope: ['profile', 'email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/user/signUp'}),(req,res)=>{
    console.log(req.user);
    req.session.user = req.user;
    res.redirect('/user/home') 
}) 
 
module.exports = router;
