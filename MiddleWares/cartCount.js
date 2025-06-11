const Cart = require('../Model/cartSchema'); 

const cartCountMiddleware = async (req, res, next) => {
    try {
        let cartCount = 0;
        const user = req.session.user;

        console.log('cartCountMiddleware: User ID:', user?._id);

        if (user && user._id) {
            const cart = await Cart.findOne({ userId: user._id }).populate('items.product');
            console.log('cartCountMiddleware: Cart found:', !!cart, 'Items:', cart?.items.length || 0);

            if (cart) {
                cartCount = cart.items.reduce((sum, item) => {
                    if (item.product && !item.product.isDeleted && !item.product.isBlocked && item.product.status === 'available') {
                        return sum + item.quantity;
                    }
                    return sum;
                }, 0);
            }
        } else {
            console.log('cartCountMiddleware: No user session');
        }

        res.locals.cartCount = cartCount;
        console.log('cartCountMiddleware: Set cartCount:', cartCount);
        next();
    } catch (error) {
        console.error('Error in cartCountMiddleware:', error.message);
        res.locals.cartCount = 0;
        next();
    }
};

module.exports = cartCountMiddleware;
