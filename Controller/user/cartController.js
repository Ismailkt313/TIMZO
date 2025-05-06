const Cart = require("../../Model/cartSchema");
const User = require("../../Model/userSchema");
const Product = require("../../Model/productSchema");

const loadcart = async (req, res) => {
    try {
        // Validate session
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).render('user/login', {
                message: 'Please log in to view your cart',
                user: null,
                search: req.query.search || '',
                cartCount: 0
            });
        }

        const userId = req.session.user._id;
        // Check if user exists and is not blocked
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

        // Fetch cart and populate products
        let cart = await Cart.findOne({ user: userId }).populate('items.product');
        let cartCount = 0;
        let total = 0;
        let recommended = [];

        if (cart) {
            // Filter out invalid items and calculate total
            cart.items = cart.items.filter(item => {
                if (item.product && !item.product.isDeleted && !item.product.isBlocked && item.product.status === 'available') {
                    total += item.product.salePrice * item.quantity;
                    return true;
                }
                return false;
            });
            await cart.save();

            // Calculate cart count
            cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

            // Fetch recommended products (excluding cart items)
            recommended = await Product.find({
                _id: { $nin: cart.items.map(item => item.product._id) },
                isDeleted: false,
                isBlocked: false,
                status: 'available'
            }).limit(4);
        }
        res.render('user/cart', {
            cart: cart || null,
            total,
            recommended,
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
        const { productId, quantity } = req.body;
        const userId = req.session.user?._id;

        // Validate session
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to add items to cart" });
        }

        // Validate input
        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ success: false, message: "Invalid product ID or quantity" });
        }

        // Check if product exists and is available
        const product = await Product.findById(productId);
        if (!product || product.isDeleted || product.isBlocked || product.status !== 'available') {
            return res.status(404).json({ success: false, message: "Product not found or unavailable" });
        }

        // Check stock
        if (product.stock < quantity) {
            return res.status(400).json({ success: false, message: "Insufficient stock" });
        }

        // Find or create cart
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        // Update or add item
        const existingItem = cart.items.find(item => item.product.toString() === productId);
        if (existingItem) {
            existingItem.quantity += parseInt(quantity);
            if (existingItem.quantity > product.stock) {
                return res.status(400).json({ success: false, message: 'Quantity exceeds available stock' });
            }
        } else {
            cart.items.push({ product: productId, quantity: parseInt(quantity) });
        }

        await cart.save();
        return res.status(200).json({ success: true, message: "Product added to cart successfully" });
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

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const item = cart.items.find(item => item.product.toString() === productId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }

        const product = await Product.findById(productId);
        if (!product || product.isDeleted || product.isBlocked || product.status !== 'available') {
            return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
        }

        if (quantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
        }

        if (quantity > product.stock) {
            return res.status(400).json({ success: false, message: 'Quantity exceeds available stock' });
        }

        item.quantity = parseInt(quantity);
        await cart.save();

        await cart.populate('items.product');
        let total = 0;
        cart.items.forEach(item => {
            if (item.product && !item.product.isDeleted && !item.product.isBlocked && item.product.status === 'available') {
                total += item.product.salePrice * item.quantity;
            }
        });

        res.status(200).json({ success: true, message: 'Cart updated successfully', total });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ success: false, message: 'Failed to update cart' });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to remove items from your cart" });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        cart.items = cart.items.filter(item => item.product.toString() !== productId);
        await cart.save();

        await cart.populate('items.product');
        let total = 0;
        cart.items.forEach(item => {
            if (item.product && !item.product.isDeleted && !item.product.isBlocked && item.product.status === 'available') {
                total += item.product.salePrice * item.quantity;
            }
        });

        res.status(200).json({ success: true, message: 'Product removed from cart', total });
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ success: false, message: 'Failed to remove product from cart' });
    }
};

const clearCart = async (req, res) => {
    try {
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to clear your cart" });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        cart.items = [];
        await cart.save();

        res.status(200).json({ success: true, message: 'Cart cleared successfully' });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ success: false, message: 'Failed to clear cart' });
    }
};

module.exports = {
    loadcart,
    addToCart,
    updateCart,
    removeFromCart,
    clearCart
};