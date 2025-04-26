const passport = require('passport')
const googlestrategy = require('passport-google-oauth20').Strategy;
const usermodal = require('../Model/userSchema')
const env = require('dotenv').config()


passport.use(new googlestrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:'/auth/google/callback'
},
async (accessToken,refreshToken,profile,done)=>{
        try {
            let user = await usermodal.findOne({googleId:profile.id});
            if(user){
                return done (null,user)
            }else{
                user = new usermodal ({
                    fullname:profile.displayName,
                    email:profile.emails[0].value,
                    googleId:profile.id
                })
                await user.save() 
                return done(null,user);
            }
        } catch (error) {

            return done(error,null)
            
        }
}

 
))

passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser((id,done)=>{
    usermodal.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err=>{
        done(err,null)
    })
})

module.exports=passport; 