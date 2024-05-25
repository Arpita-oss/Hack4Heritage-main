const express = require('express');
const router = express.Router();
const passport = require('passport');
const users = require('../routes/users');
const GoogleStrategy = require('passport-google-oidc');
const runGeminiAI = require('../Biodiversity/gemini');
require('dotenv').config();
const uploadToDrive = require('./drive');

// google strategy code for passport js
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/oauth2/redirect/google',
  scope: ['profile', 'email']
}, async function verify(issuer, profile, cb) {
  let user = await users.findOne({ email: profile.emails[0].value });
  if (user) {
    return cb(null, user);
  }
  let newUser = await users.create({
    name: profile.displayName,
    email: profile.emails[0].value,
  });
  await newUser.save();
  return cb(null, newUser);
}));

/* GET home page. */
router.get('/', function(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }
  return res.render('index');
});

router.get('/login', function(req, res, next) {
  res.render('login');
});

router.get('/upload', function(req, res, next) {
  res.render('upload');
});

router.get('/choice', function(req, res, next) {
  res.render('choice');
});
router.get('/info', async function(req, res, next) {
  const filePath = req.query.filePath;
  if (!filePath) {
    return res.status(400).send('File path is undefined');
  }

  try {
    const jsonResponse = await runGeminiAI(filePath);
    res.render('info', { jsonResponse });
  } catch (error) {
    next(error);
  }
});




router.get('/login/federated/google', passport.authenticate('google'));

router.get('/oauth2/redirect/google', passport.authenticate('google', {
  successRedirect: '/choice',
  failureRedirect: '/login'
}));

router.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    console.log('File uploaded:', req.file);
    if (!req.file) {
      throw new Error('File is missing');
    }

    const authClient = await authorize();
    console.log('Authorized client:', authClient);
    
    const uploadedFile = await uploadToDrive(authClient, req.file);
    console.log('Uploaded file:', uploadedFile);

    if (!uploadedFile) {
      throw new Error('File upload failed');
    }

    req.uploadedFile = uploadedFile;
    res.redirect(`/info?filePath=${encodeURIComponent(req.file.path)}`);
  } catch (error) {
    console.error('Error in upload route:', error);
    next(error);
  }
});



module.exports = router;
