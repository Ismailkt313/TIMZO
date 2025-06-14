const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../Model/userSchema");
const env = require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://timzo.store/auth/google/callback",
      passReqToCallback: true, // ✅ Add this
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          req.session.user = user; // ✅ safe to use now
          return done(null, user);
        }

        const newUser = new User({
          fullname: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
        });

        await newUser.save();
        req.session.user = newUser; // ✅ set the session
        return done(null, newUser);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

module.exports = passport;
