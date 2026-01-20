// config/passport.js (or wherever your passport file is)
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL, // ✅ must be full https URL in Render env
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // ✅ Google email
        const email = profile?.emails?.[0]?.value;

        if (!email) {
          return done(null, false, { message: "Google account email not found" });
        }

        // ✅ university email only
        const universityDomain =
          process.env.UNIVERSITY_DOMAIN || "@brainwareuniversity.ac.in";

        if (!email.endsWith(universityDomain)) {
          return done(null, false, { message: "Only university email allowed" });
        }

        // ✅ find user
        let user = await User.findOne({ email });

        // ✅ create user if new (BUT NOT VERIFIED & NOT COMPLETE)
        if (!user) {
          user = await User.create({
            name: profile.displayName || "Student",
            email,
            password: "GOOGLE_AUTH", // dummy password

            // ✅ Google flags
            isGoogleUser: true,
            isProfileComplete: false,

            // ✅ OTP must be verified like email users
            isVerified: false,

            // ✅ These will be filled later in Google complete profile page
            programType: undefined,
            department: undefined,
            year: undefined,
            studentCode: "",

            role: "student",
            hasSeenWelcome: false,
          });
        }

        // ✅ If user exists but was created earlier from normal signup,
        // we should not change their data.
        // Only ensure Google flag for google login users.
        if (user && !user.isGoogleUser) {
          // ✅ If a normal email user later uses Google with same email
          // just allow login, no changes required.
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
