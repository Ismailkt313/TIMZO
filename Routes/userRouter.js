const express = require('express');
const router = express.Router();
const userController = require("../Controller/user/userController");
const passport = require('passport');

router.get('/',userController.loadlanding);
router.get('/sign-up',userController.loadSignUp)
router.post('/sign-up',userController.signup)
router.post('/verify-otp',userController.verifyOtp)
router.get('/error404',userController.pageNotFound)
router.get('/home',userController.loadhome)
router.post('/resend-otp', userController.resendOtp);

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/user/signUp'}),(req,res)=>{
    res.redirect('/user/home')
})

module.exports = router;
