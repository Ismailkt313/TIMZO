const User = require("../../Model/userSchema")
const Cart = require("../../Model/cartSchema")


const loadAccount = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/user/login');
        }
        const user = await User.findById(req.session.user._id);
        if (!user || user.isBlocked) {
            req.session.user = null;
            return res.redirect('/user/login');
        }

        let cartCount = 0;
        const cart = await Cart.findOne({ user: req.session.user._id });
        if (cart) {
            cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        }

        res.render('user/userProfile', {
            user: req.session.user,
            cartCount,
            currentPage: 'profile'
        });
    } catch (error) {
        console.error('Error loading account:', error);
        res.redirect('/error404');
    }
};

module.exports={
    loadAccount
}