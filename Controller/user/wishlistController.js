const Product = require("../../Model/productSchema");
const User = require("../../Model/userSchema");
const Wishlist = require("../../Model/wishlistSchema");
const Cart = require('../../Model/cartSchema')
const mongoose = require('mongoose');



const loadsidewishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;

        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'products.productId',
                match: { isListed: true, status: 'available' },
                populate: { path: 'brand' }
            });

        const filteredProducts = wishlist ? wishlist.products.filter(p => p.productId) : [];

        res.render('user/sidebarWishlist', {
            wishlist: filteredProducts,
            currentPage:"wishlist   ",
            user: req.session.user
        });
    } catch (error) {
        console.error("Error loading wishlist:", error);
        if (req.accepts('json')) {
            res.status(500).json({ success: false, message: "Failed to load wishlist" });
        } else {
            res.status(500).render('user/error', {
                message: "Failed to load wishlist",
                user: req.session.user || null
            });
        }
    }
}

const loadwishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;

        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'products.productId',
                match: { isListed: true, status: 'available' },
                populate: { path: 'brand' }
            });

        const filteredProducts = wishlist ? wishlist.products.filter(p => p.productId) : [];

        res.render('user/wishlist', {
            wishlist: filteredProducts,
            user: req.session.user,
            search: req.query.search || '',

        });
    } catch (error) {
        console.error("Error loading wishlist:", error);
        if (req.accepts('json')) {
            res.status(500).json({ success: false, message: "Failed to load wishlist" });
        } else {
            res.status(500).render('user/error', {
                message: "Failed to load wishlist",
                user: req.session.user || null
            });
        }
    }
};

const addTOWishlist = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            console.log('No user session found:', req.session);
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const userId = req.session.user._id;
        const { productId } = req.body;

        if (!productId) {
            console.log('Product ID missing');
            return res.status(400).json({ success: false, message: "Product ID is required" });
        }

        const productExists = await Product.findOne({
            _id: productId,
            isListed: true,
            status: 'available'
        });
        if (!productExists) {
            console.log('Product not found or unavailable:', productId);
            return res.status(404).json({ success: false, message: "Product not found or unavailable" });
        }


        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            console.log('Creating new wishlist for user:', userId);
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
        } else {
            const alreadyExists = wishlist.products.some(
                (item) => item.productId.toString() === productId
            );

            if (alreadyExists) {
                console.log('Product already in wishlist:', productId);
                return res.status(409).json({ success: false, message: "Product already in wishlist" });
            }

            wishlist.products.push({ productId });
        }

        const savedWishlist = await wishlist.save();

        res.status(200).json({ success: true, message: "Product added to wishlist" });
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error: " + error.message });
    }
};

const removeWishlist = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            console.log('No user session found:', req.session);
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const userId = req.session.user._id;
        const { productId } = req.body;

        if (!productId) {
            console.log('Product ID missing');
            return res.status(400).json({ success: false, message: "Product ID is required" });
        }

        const result = await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        if (result.modifiedCount === 0) {
            console.log('Product not found in wishlist:', productId);
            return res.status(404).json({ success: false, message: "Product not found in wishlist" });
        }

        res.status(200).json({ success: true, message: "Product removed from wishlist" });
    } catch (error) {
        console.error("Error removing wishlist item:", error);
        res.status(500).json({ success: false, message: "Server error: " + error.message });
    }
};

const addToCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, quantity } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        const objectProductId = new mongoose.Types.ObjectId(productId);

        const wishlist = await Wishlist.findOne({ userId });

        if (wishlist && wishlist.products.some(item => item.productId.toString() === productId)) {
            await Wishlist.updateOne(
                { userId },
                { $pull: { products: { productId: objectProductId } } }
            );
        }

        let existingCart = await Cart.findOne({ userId });

        if (existingCart) {
            const itemIndex = existingCart.items.findIndex(item => item.product.toString() === productId);
            if (itemIndex > -1) {
                const currentQty = existingCart.items[itemIndex].quantity;
                const newQty = currentQty + parseInt(quantity);

                if (newQty > 5) {
                    return res.status(400).json({
                        success: false,
                        message: 'You can only add up to 5 of the same item in your cart.'
                    });
                }

                if (newQty > product.stock) {
                    return res.status(400).json({
                        success: false,
                        message: `Only ${product.stock} items available in stock.`
                    });
                }

                existingCart.items[itemIndex].quantity = newQty;
            } else {
                existingCart.items.push({ product: productId, quantity: parseInt(quantity) });
            }

            await existingCart.save();
        } else {
            const newCart = new Cart({
                userId,
                items: [{ product: productId, quantity: parseInt(quantity) }]
            });
            await newCart.save();
        }

        const cart = await Cart.findOne({ userId });
        const cartCount = cart.items.reduce((acc, item) => acc + item.quantity, 0);

        res.status(200).json({
            success: true,
            message: 'Item added to cart and removed from wishlist (if present).',
            cartCount
        });

    } catch (error) {
        console.error('Error adding to cart from wishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again later.'
        });
    }
};



module.exports = {
    loadwishlist,
    addTOWishlist,
    removeWishlist,
    addToCart,
    loadsidewishlist
};