const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Failed login',
    successRedirect: '/',
    successFlash: 'You are now logged in.'
});

exports.logout = (req, res) => {
    req.logout();
    req.flash('success', 'You are now logged out.!');
    res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated())
        return next();

    req.flash('error', 'Oops.. You must be logged in to do that.!');
    res.redirect('/login');
};

exports.fogot = async (req, res) => {
    //1. See with the user with that email exist
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        req.flash('error', 'No account with that email exist');
        return res.redirect('/login');
    }
    //2. Set reset tokens and expire on their account
    user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
    await user.save();
    //3. Send them an email with the token
    const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
    await mail.send({
        user,
        subject: 'Password reset',
        resetURL,
        filename: 'password-reset'
    });
    req.flash('success', `You have been an emailed a password reset link.`);
    //4. Redirect login page
    res.redirect('/login');
};

exports.reset = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) {
        req.flash('error', 'Password reset in invalid or has expired.');
        res.redirect('/login');
    }

    res.render('reset', { title: 'Reset your password.' });
};

exports.confirmedPassword = (req, res, next) => {
    if (req.body.password === req.body['password-confirm']) {
        return next();
    }
    req.flash('error', 'Password do not match.');
    res.redirect('back');
};

exports.update = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) {
        req.flash('error', 'Password reset in invalid or has expired.');
        res.redirect('/login');
    }

    const setPassword = promisify(user.setPassword, user);
    await setPassword(req.body.password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    const updateUser = await user.save();
    await req.login(updateUser);
    req.flash('success', 'Great your password was reseted.');
    res.redirect('/');
};