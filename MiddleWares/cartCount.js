const Cart = require('../Model/cartSchema');

const cartCountMiddleware = async (req, res, next) => {
    try {
        if (!req.session || !req.session.user) {
            res.locals.cartCount = 0;
            return next();
        }

        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId });
        res.locals.cartCount = cart ? cart.items.length : 0;
        next();
    } catch (err) {
        console.error("Error in cartCountMiddleware:", err);
        res.locals.cartCount = 0;
        next();
    }
};


module.exports = cartCountMiddleware;
