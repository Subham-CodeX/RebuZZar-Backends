const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        // ✅ university email only
        const universityDomain = process.env.UNIVERSITY_DOMAIN || '@brainwareuniversity.ac.in';
        if (!email.endsWith(universityDomain)) {
          return done(null, false, { message: 'Only university email allowed' });
        }

        let user = await User.findOne({ email });

        // ✅ create user if new
        if (!user) {
          user = await User.create({
            name: profile.displayName,
            email,
            password: 'GOOGLE_AUTH', // dummy
            isVerified: true,         // auto verified
            programType: 'UG',        // temporary
            department: 'Unknown',
            year: '1st',
            role: 'student',
          });
        }

        return done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);
