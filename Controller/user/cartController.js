const Cart = require("../../Model/cartSchema");
const User = require("../../Model/userSchema");
const Wishlist = require('../../Model/wishlistSchema')
const Coupon = require('../../Model/coupenSchema')
const Product = require("../../Model/productSchema");
const loadcart = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).render('user/login', {
                message: 'Please log in to view your cart',
                user: null,
                search: req.query.search || '',
                cartCount: 0
            });
        }

        const userId = req.session.user._id;
        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            req.session.user = null;
            return res.status(403).render('user/login', {
                message: user?.isBlocked ? 'Your account has been blocked' : 'User not found',
                user: null,
                search: req.query.search || '',
                cartCount: 0
            });
        }

        let cart = await Cart.findOne({ userId }).populate('items.product');
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }
        const availableCoupons = await Coupon.find({
            isActive: true,
            validFrom: { $lte: new Date() },
            validUntil: { $gte: new Date() },
        });
        let cartCount = 0;
        let subtotal = 0;
        let tax = 0;
        const shippingFee = 10;
        let total = 0;
        let recommended = [];
        let couponDiscount = cart.coupon && cart.coupon.discount ? cart.coupon.discount : 0;
        const stockError = req.query.stockError === '1';

        if (cart) {
            cart.items = cart.items.filter(item => {
                if (item.product && !item.product.isDeleted && !item.product.isBlocked && item.product.status === 'available') {
                    subtotal += item.product.salePrice * item.quantity;
                    return true;
                }
                return false;
            });
            await cart.save();

            cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            tax = +(subtotal * 0.10).toFixed(2)
            total = subtotal + tax + shippingFee - couponDiscount;
            recommended = await Product.find({
                _id: { $nin: cart.items.map(item => item.product._id) },
                isDeleted: false,
                isBlocked: false,
                status: 'available'
            }).limit(4);
        }
        res.render('user/cart', {
            cart: cart || null,
            subtotal,
            tax,
            shippingFee,
            stockError,
            total,
            recommended,
            availableCoupons,
            user: req.session.user,
            search: req.query.search || '',
            cartCount
        });
    } catch (error) {
        console.error('Error loading cart:', error);
        res.status(500).render('user/error', {
            message: 'An error occurred while loading your cart. Please try again later.',
            user: req.session.user || null,
            search: req.query.search || '',
            cartCount: 0
        });
    }
};
const addToCart = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            console.log('No userId found in session');
            return res.status(401).json({ success: false, message: "Please log in to add items to cart" });
        }

        const { productId, quantity } = req.body;
        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ success: false, message: "Invalid product ID or quantity" });
        }

        const product = await Product.findById(productId);
        if (!product || product.isDeleted || !product.isListed || product.status !== 'available') {
            return res.status(404).json({ success: false, message: "Product not found or unavailable" });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ success: false, message: "Insufficient stock" });
        }

        if (quantity > 5) {
            return res.status(400).json({ success: false, message: "Maximum quantity of the same product is 5" });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            console.log('Creating new cart for userId:', userId);
            cart = new Cart({ userId, items: [] });
        }

        const existingItem = cart.items.find(item => item.product.toString() === productId);
        if (existingItem) {
            const newQuantity = existingItem.quantity + parseInt(quantity);
            if (newQuantity > 5) {
                return res.status(400).json({ success: false, message: "Maximum quantity of the same product is 5" });
            }
            if (newQuantity > product.stock) {
                return res.status(400).json({ success: false, message: "Quantity exceeds available stock" });
            }
            existingItem.quantity = newQuantity;
        } else {
            cart.items.push({
                product: productId,
                quantity: parseInt(quantity),
            });
        }

        await cart.save();

        const wishlist = await Wishlist.findOne({ userId });
        if (wishlist && wishlist.products.some(p => p.productId.toString() === productId)) {
            await Wishlist.updateOne(
                { userId },
                { $pull: { products: { productId: productId } } }
            );
        }

        await cart.populate('items.product');

        let cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        let total = cart.items.reduce((sum, item) => {
            if (item.product && !item.product.isDeleted && !item.product.isBlocked && item.product.status === 'available') {
                return sum + item.product.salePrice * item.quantity;
            }
            return sum;
        }, 0);

        return res.status(200).json({
            success: true,
            message: "Product added to cart successfully",
            cartCount,
            total
        });
    } catch (error) {
        console.error("Error occurred while adding to cart:", error);
        return res.status(500).json({ success: false, message: "Failed to add product to cart" });
    }
};


const updateCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to update your cart" });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        const item = cart.items.find(item => item.product.toString() === productId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Product not found in cart" });
        }

        const product = await Product.findById(productId);
        if (!product || product.isDeleted || product.isBlocked || product.status !== 'available') {
            return res.status(404).json({ success: false, message: "Product not found or unavailable" });
        }

        if (quantity < 1) {
            return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
        }

        if (quantity > product.stock) {
            return res.status(400).json({ success: false, message: "Quantity exceeds available stock" });
        }

        if (quantity > 5) {
            return res.status(400).json({ success: false, message: "Maximum quantity of the same product is 5" });
        }

        item.quantity = parseInt(quantity);
        await cart.save();

        await cart.populate('items.product');

        let total = 0;
        let cartCount = 0;

        cart.items.forEach(item => {
            if (
                item.product &&
                !item.product.isDeleted &&
                !item.product.isBlocked &&
                item.product.status === 'available'
            ) {
                total += item.product.salePrice * item.quantity;
                cartCount += item.quantity;
            }
        });

        let tax = +(total * 0.10).toFixed(2);
        let shippingFee = 10;
        let grandTotal = +(total + tax + shippingFee).toFixed(2);

        res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            total,
            tax,
            shippingFee,
            grandTotal,
            cartCount
        });

    } catch (error) {
        console.error("Error updating cart:", error);
        res.status(500).json({ success: false, message: "Failed to update cart" });
    }
};


const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to remove items from your cart" });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        cart.items = cart.items.filter(item => item.product.toString() !== productId);
        await cart.save();

        await cart.populate('items.product');
        let total = 0;
        let cartCount = 0;
        cart.items.forEach(item => {
            if (item.product && !item.product.isDeleted && !item.product.isBlocked && item.product.status === 'available') {
                total += item.product.salePrice * item.quantity;
                cartCount += item.quantity;
            }
        });

        const tax = +(total * 0.10).toFixed(2);
        const shippingFee = 10;
        const grandTotal = +(total + tax + shippingFee).toFixed(2);

        res.status(200).json({
            success: true,
            message: "Product removed from cart",
            total,
            tax,
            shippingFee,
            grandTotal,
            cartCount
        });

    } catch (error) {
        console.error("Error removing from cart:", error);
        res.status(500).json({ success: false, message: "Failed to remove product from cart" });
    }
};

const clearCart = async (req, res) => {
    try {
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to clear your cart" });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        cart.items = [];
        await cart.save();

        res.status(200).json({
            success: true,
            message: "Cart cleared successfully",
            total: 0,
            cartCount: 0
        });
    } catch (error) {
        console.error("Error clearing cart:", error);
        res.status(500).json({ success: false, message: "Failed to clear cart" });
    }
};

module.exports = {
    loadcart,
    addToCart,
    updateCart,
    removeFromCart,
    clearCart
};