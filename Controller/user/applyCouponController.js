const Cart = require('../../Model/cartSchema')
const Coupon = require('../../Model/coupenSchema')


const applyCoupon = async(req,res)=>{
    try {
        const {couponCode} = req.body;
        const userId = req.session.user._id
        console.log('amritha cart')

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
        console.log('cart indoo',cart)

        
const subtotal = cart.items.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0);
        if(coupon.minPurchase && subtotal < coupon.minPurchase){
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchase} required`
            });
        }
        console.log('ithan paisa',subtotal)
        if(coupon.usageLimit && coupon.usedCount >= coupon.usageLimit){
            return res.status(400).json({ success: false, message: 'Coupon usage limit exceeded' });
        }

        const userUsage = await Cart.countDocuments({
            user:userId,
            'coupon.code': couponCode.toUpperCase()
        })
        if (coupon.perUserLimit && userUsage >= coupon.perUserLimit) {
            return res.status(400).json({ success: false, message: 'You have reached the usage limit for this coupon' });
        }

        let couponDiscount = 0
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
        const shippingFee =10;
        const taxRate = 0.1;
        const tax = subtotal * taxRate;
        const total = subtotal + shippingFee + tax - couponDiscount;



        await cart.save()

        coupon.usedCount = (coupon.usedCount || 0) + 1;
        await coupon.save()

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
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Server error while applying coupon' });
    
    }
}

module.exports={
    applyCoupon
}