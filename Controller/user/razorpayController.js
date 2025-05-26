const Razorpay = require('razorpay');
const Cart = require('../../Model/cartSchema');
const Order = require('../../Model/orderSchema');
const Product = require('../../Model/productSchema'); // Added missing import
const Wishlist = require('../../Model/wishlistSchema'); // Corrected import name
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZERPAY_KEY_ID,
    key_secret: process.env.RAZERPAY_KEY_SECRET
});

const createRazorpayOrder = async (req, res) => {
    try {
        const { addressId, orderId } = req.body;
        console.log(req.body)
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in to place an order' });
        }

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order ID is required' });
        }

        const order = await Order.findById(orderId);
        if (!order || order.user.toString() !== userId) {
            return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
        }

        const cart = await Cart.findOne({ userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        // Calculate total
        let total = 0;
        cart.items.forEach(item => {
            if (item.product && item.product.salePrice) {
                total += item.product.salePrice * item.quantity;
            }
        });

        const subtotal = total;
        const shippingFee = 10;
        const tax = subtotal * 0.10;
        const totalAmount = subtotal + shippingFee + tax;

        // Verify the order's totalAmount matches
        if (Math.round(totalAmount * 100) !== Math.round(order.totalAmount * 100)) {
            return res.status(400).json({ success: false, message: 'Order amount mismatch' });
        }

        // Create Razorpay order
        const options = {
            amount: Math.round(totalAmount * 100), // Amount in paise
            currency: 'INR',
            receipt: `receipt_${order.orderId}`
        };

        const razorpayOrder = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            razorpayOrder,
            razorpayKey: process.env.RAZERPAY_KEY_ID,
            orderDetails: {
                orderId: order._id,
                totalAmount
            }
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
        const userId = req.session.user?._id;
        console.log('razor pay items req.body',req.body)
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in to verify payment' });
        }

        // Verify payment signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZERPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Update order status
        const order = await Order.findById(orderId);
        if (!order || order.user.toString() !== userId) {
            return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
        }

        order.paymentStatus = 'Completed';
        order.orderStatus = 'Processing';
        order.statusHistory.push({
            status: 'Processing',
            date: new Date(),
            current: true
        });

        await order.save();

        // Update stock and clear cart
        const cart = await Cart.findOne({ userId }).populate('items.product');
        for (const item of cart.items) {
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { stock: -item.quantity }
            });
        }

        const purchasedProductIds = cart.items.map(item => item.product._id);
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId: { $in: purchasedProductIds } } } }
        );

        await Cart.findOneAndUpdate({ userId }, { items: [] });

        res.status(200).json({ success: true, orderId: order._id });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};

module.exports = {
    createRazorpayOrder,
    verifyPayment
};