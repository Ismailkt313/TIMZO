const Razorpay = require('razorpay');
const Cart = require('../../Model/cartSchema');
const Order = require('../../Model/orderSchema');
const Product = require('../../Model/productSchema');
const Wishlist = require('../../Model/wishlistSchema');
const Coupon = require('../../Model/coupenSchema')
const crypto = require('crypto');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const createRazorpayOrder = async (req, res) => {
    try {
        const { addressId, orderId } = req.body;
        console.log('Create Razorpay order request:', req.body);
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

        if (order.paymentStatus !== 'Pending') {
            return res.status(400).json({ success: false, message: 'Order payment status is not pending' });
        }

        const totalAmount = order.totalAmount;

        const options = {
            amount: Math.round(totalAmount * 100),
            currency: 'INR',
            receipt: `receipt_${order.orderId}`
        };

        const razorpayOrder = await razorpay.orders.create(options);
        console.log(`Razorpay order created: ${razorpayOrder.id}`);

        res.status(200).json({
            success: true,
            razorpayOrder,
            razorpayKey: process.env.RAZORPAY_KEY_ID,
            orderDetails: {
                orderId: order._id,
                totalAmount
            }
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);

        if (error && typeof error === 'object') {
            console.error('Full error object:', JSON.stringify(error, null, 2));
        } else {
            console.error('Error is not an object:', error);
        }

        res.status(500).json({
            success: false,
            message: `Failed to create payment order: ${error?.message || 'Unknown error'}`
        });
    }
}

const verifyPayment = async (req, res) => {
    console.log('Received verify payment request:', JSON.stringify(req.body, null, 2));
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
        const userId = req.session.user?._id;
        console.log('User ID:', userId, 'Order ID:', orderId);

        if (!userId) {
            console.log('No user ID in session');
            return res.status(401).json({ success: false, message: 'Please log in to verify payment' });
        }

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
            console.log('Missing required fields:', { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId });
            return res.status(400).json({ success: false, message: 'Missing required payment details' });
        }

        console.log('Verifying payment signature');
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.log('Invalid payment signature:', { expectedSignature, razorpay_signature });
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        console.log('Fetching order:', orderId);
        const order = await Order.findById(orderId);
        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.user.toString() !== userId.toString()) {
            console.log('Unauthorized user for order:', { orderId, userId, orderUser: order.user.toString() });
            return res.status(400).json({ success: false, message: 'Unauthorized access to order' });
        }

        console.log('Current payment status:', order.paymentStatus);
        if (order.paymentStatus === 'Completed') {
            console.log(`Order ${orderId} already verified for user ${userId}`);
            return res.status(200).json({ success: true, orderId: order._id });
        }

        if (order.paymentStatus !== 'Pending') {
            console.log('Invalid payment status:', order.paymentStatus);
            return res.status(400).json({ success: false, message: 'Order payment status is not pending' });
        }

        console.log('Validating stock for order items:', order.items.length);
        for (const item of order.items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                console.log('Product not found:', item.productName);
                return res.status(400).json({
                    success: false,
                    message: `Product not found: ${item.productName}`
                });
            }
            if (product.stock < item.quantity) {
                console.log('Insufficient stock for product.productName:', item.productName, 'Stock:', product.stock, 'Required:', item.quantity);
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product ${item.productName}`
                });
            }
        }

        console.log('Updating order status');
        order.paymentStatus = 'Completed';
        order.orderStatus = 'Processing';
        order.statusHistory = order.statusHistory.map(item => ({ ...item, current: false }));
        order.statusHistory.push({
            status: 'Processing',
            date: new Date(),
            current: true
        });

        console.log('Order before saving:', JSON.stringify({ paymentStatus: order.paymentStatus, orderStatus: order.orderStatus, statusHistory: order.statusHistory }, null, 2));
        try {
            await order.save({ validateBeforeSave: true });
            console.log('Order saved successfully:', order.orderStatus, 'Payment Status:', order.paymentStatus, 'Order Status');
        } catch (saveError) {
            console.error('Failed to save order:', saveError.message, saveError.stack);
            return res.status(500).json({
                success: false,
                message: `Failed to save order: ${saveError.message}`
            });
        }

        if (order.coupon && order.coupon.code) {
            console.log('Checking coupon:', order.coupon.code);
            const coupon = await Coupon.findOne({ code: order.coupon.code });
            if (coupon) {
                coupon.usedCount = (coupon.usedCount || 0) + 1;
                await coupon.save();
                console.log('Coupon coupon.code used:', coupon.usedCount, 'Coupon usedCount incremented to');
            } else {
                console.warn('Coupon not found during payment verification:', order.coupon.code);
            }
        }

        console.log('Updating product stock');
        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity }
            });
        }

        console.log('Clearing wishlist');
        const purchasedProductIds = order.items.map(item => item.productId);
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId: { $in: purchasedProductIds } } } }
        );

        console.log('Clearing cart');
        const cart = await Cart.findOne({ userId });
        if (cart) {
            cart.items = [];
            cart.coupon = null;
            await cart.save();
        } else {
            console.warn('Cart not found for user during payment verification:', userId);
        }

        console.log('Payment verified successfully for order:', orderId);
        return res.status(200).json({ success: true, orderId: order._id });
    } catch (error) {
        console.error('Error verifying payment:', error.message, error.stack);
        return res.status(500).json({ success: false, message: `Payment verification failed: ${error.message}` });
    }
};

const retryPayment = async (req, res) => {
    console.log('Received retry payment request:', req.params, req.session.user);
    try {
        const { id: orderId } = req.params;
        const userId = req.session.user?._id;

        if (!userId) {
            console.log('No user ID in session');
            return res.status(401).json({ success: false, message: 'Please log in to retry payment' });
        }

        console.log('Fetching order:', orderId);
        const order = await Order.findById(orderId).populate('items.productId');
        if (!order || order.user.toString() !== userId) {
            console.log('Order not found or unauthorized:', orderId, userId);
            return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
        }

        if (order.paymentStatus !== 'Pending') {
            console.log('Invalid payment status:', order.paymentStatus);
            return res.status(400).json({ success: false, message: 'Payment retry is only allowed for pending orders' });
        }

        console.log('Validating order items:', order.items.length);
        for (let i = 0; i < order.items.length; i++) {
            const item = order.items[i];
            const product = item.productId;

            if (!product) {
                console.log('Product not found for item:', i);
                return res.status(400).json({
                    success: false,
                    message: `Product not found for item at index ${i}`,
                });
            }

            if (item.finalPrice === undefined || item.discount === undefined || item.itemTotal === undefined) {
                console.log('Fixing item fields for item:', i);
                item.finalPrice = item.finalPrice || product.salePrice || product.price;
                item.discount = item.discount || 0;
                item.itemTotal = item.itemTotal || item.finalPrice * item.quantity;
            }

            if (product.stock < item.quantity) {
                console.log('Insufficient stock for product:', item.productName || product.name);
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product ${item.productName || product.name}`,
                });
            }
        }

        const totalAmount = order.totalAmount;
        console.log('Creating Razorpay order for amount:', totalAmount);
        const options = {
            amount: Math.round(totalAmount * 100),
            currency: 'INR',
            receipt: `retry_receipt_${order.orderId}_${Date.now()}`,
        };

        const razorpayOrder = await razorpay.orders.create(options);
        console.log('Razorpay retry order created:', razorpayOrder.id);

        await order.save({ validateBeforeSave: true });
        console.log('Order saved:', order._id);

        res.status(200).json({
            success: true,
            razorpayOrder,
            razorpayKey: process.env.RAZORPAY_KEY_ID,
            orderDetails: {
                orderId: order._id,
                totalAmount,
            },
            message: 'Payment retry initiated successfully',
        });
    } catch (error) {
        console.error('Error retrying payment:', error.message, error.stack);
        res.status(500).json({
            success: false,
            message: `Failed to retry payment: ${error.message || 'Unknown error'}`,
        });
    }
};
module.exports = {
    createRazorpayOrder,
    verifyPayment,
    retryPayment
};