const Cart = require('../../Model/cartSchema')
const Coupon = require('../../Model/coupenSchema')
const User = require('../../Model/userSchema');
const Order = require('../../Model/orderSchema');


const applyCoupon = async (req, res) => {
    try { 
        const { couponCode } = req.body;
        const userId = req.session.user._id;

        const coupon = await Coupon.findOne({
            code: couponCode.toUpperCase(),
            isActive: true,
            validFrom: { $lte: new Date() },
            validUntil: { $gte: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
        }

        let cart = await Cart.findOne({ userId }).populate("items.product");
        if (!cart) {
            console.log('No cart found, creating a new one');
            cart = new Cart({ userId, items: [] });
            await cart.save();
        }
        console.log('Cart details:', cart);

        const subtotal = cart.items.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0);
        if (coupon.minPurchase && subtotal < coupon.minPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchase} required`
            });
        }
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit exceeded' });
        }

        const userUsage = await Order.countDocuments({
            user: userId,
            'coupon.code': couponCode.toUpperCase()
        });

        if (coupon.perUserLimit && userUsage >= coupon.perUserLimit) {
            return res.status(400).json({ success: false, message: 'You have reached the usage limit for this coupon' });
        }

        let couponDiscount = 0;
        if (coupon.discountType === 'percentage') {
            couponDiscount = (coupon.discountAmount / 100) * subtotal;
            if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                couponDiscount = coupon.maxDiscount;
            }
        } else {
            couponDiscount = coupon.discountAmount;
        }
        if (couponDiscount > subtotal) {
            couponDiscount = subtotal;
        }

        const shippingFee = 10;
        const taxRate = 0.1;
        const tax = subtotal * taxRate;
        const total = subtotal + shippingFee + tax - couponDiscount;

        cart.coupon = {
            code: coupon.code,
            percentage: coupon.discountType === 'percentage' ? coupon.discountAmount : 0,
            maxDiscount: coupon.maxDiscount || 0
        };

        console.log('Saving coupon in cart:', cart.coupon);
        await cart.save();

        const updatedCart = await Cart.findOne({ userId });
        console.log('Cart after saving:', updatedCart);

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            subtotal,
            shippingFee,
            tax,
            total,
            couponDiscount,
            couponCode: coupon.code
        });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ success: false, message: `Server error while applying coupon: ${error.message}` });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user.id;
        let cart = await Cart.findOne({ userId }).populate("items.product");
        if (!cart || cart.items.length === 0) {
            console.log('Cart is empty or not found');
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        const subtotal = cart.items.reduce((sum, item) => {
            if (item.product && !item.product.isDeleted && !item.product.isBlocked) {
                return sum + (item.product.salePrice * item.quantity);
            }
            return sum;
        }, 0);

        console.log("Subtotal after filtering items:", subtotal);

        cart.coupon = null;
        await cart.save();

        const shippingFee = 10;
        const taxRate = 0.1;
        const tax = subtotal * taxRate;
        const total = subtotal + shippingFee + tax;

        let savedAmount = 0;
        cart.items.forEach(item => {
            if (item.product.regularPrice && item.product.regularPrice > item.product.salePrice) {
                savedAmount += (item.product.regularPrice - item.product.salePrice) * item.quantity;
            }
        });

        return res.json({
            success: true,
            message: 'Coupon removed successfully',
            subtotal,
            shippingFee,
            tax,
            total,
            couponDiscount: 0,
            savedAmount
        });
    } catch (error) {
        console.error('Error removing coupon:', error);
        return res.status(500).json({ success: false, message: `Server error while removing coupon: ${error.message}` });
    }
};

const loadAvailableCoupons = async (req, res) => {
    try {
        const userId = req.session.user._id;
        if (!userId) {
            return res.status(401).render('error404', { message: 'Please log in to view available coupons' });
        }

        const currentDate = new Date();

        const coupons = await Coupon.find({
            validFrom: { $lte: currentDate },
            validUntil: { $gte: currentDate },
            isActive: true,
        }).lean();

        const userOrders = await Order.find({ user: userId, coupon: { $ne: null } })
            .select('coupon')
            .lean();

        const couponUsage = {};
        userOrders.forEach(order => {
            if (order.coupon) {
                couponUsage[order.coupon] = (couponUsage[order.coupon] || 0) + 1;
            }
        });

        const availableCoupons = coupons.filter(coupon => {
            const timesUsed = couponUsage[coupon.code] || 0;
            return !coupon.usageLimitPerUser || timesUsed < coupon.usageLimitPerUser;
        });

        res.render('user/availableCoupon', {
            user: req.session.user,
            coupons: availableCoupons,
        });
    } catch (error) {
        console.error('Error loading available coupons:', error);
        res.status(500).render('error404', { message: 'Failed to load available coupons: ' + error.message });
    }
};

module.exports = {
    applyCoupon,
    removeCoupon,
    loadAvailableCoupons
}