const Product = require("../../Model/productSchema");
const User = require("../../Model/userSchema");
const Wishlist = require("../../Model/wishlistSchema");

const loadwishlist = async (req, res) => {
    try {
        // Ensure user is authenticated
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const wishlist = await Wishlist.findOne({ userId: req.session.user._id })
            .populate({
                path: 'products.productId',
                populate: { path: 'brand' } 
            });

        res.render('user/wishlist', {
            wishlist: wishlist?.products || [],
            user: req.session.user
        });
    } catch (error) {
        console.error("Error loading wishlist:", error);
        res.status(500).render('error', { message: "Failed to load wishlist" });
    }
};

const addTOWishlist = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const userId = req.session.user._id;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, message: "Product ID is required" });
        }

        const productExists = await Product.findById(productId);
        if (!productExists) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
        } else {
            const alreadyExists = wishlist.products.some(
                (item) => item.productId.toString() === productId
            );

            if (alreadyExists) {
                return res.status(409).json({ success: false, message: "Product already in wishlist" });
            }

            wishlist.products.push({ productId });
        }

        await wishlist.save();

        res.status(200).json({ success: true, message: "Product added to wishlist" });
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error: " + error.message });
    }
};

const removeWishlist = async(req,res)=>{
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }
        const {productId} = req.body
         console.log(productId)
         await Wishlist.updateOne(
            { userId: req.session.user._id },
            { $pull: { products: { productId: productId } } }
          );

          res.status(200).json({ success: true, message: 'Product removed from wishlist' });

    } catch (error) {
        console.error("Error removing wishlist item:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

module.exports = {
    loadwishlist,
    addTOWishlist,
    removeWishlist
};