const mongoose = require('mongoose');
const User = require("../../Model/userSchema");
const Order = require("../../Model/orderSchema");
const Product = require("../../Model/productSchema");
const Wallet = require("../../Model/walletSchema");
const Review = require('../../Model/review')
const path = require('path');
const fs = require('fs');
const { generateInvoicePDF } = require('../../Helpers/pdfService');

const viewOrderDetail = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).render("user/login", {
                message: "Please log in to view your order details",
                user: null
            });
        }
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).render("error404", { message: "Invalid order ID" });
        }
        const order = await Order.findById(id).populate('items.productId');
        if (!order) {
            return res.status(404).render("error404", { message: "Order not found" });
        }
        if (order.user.toString() !== userId) {
            return res.status(403).render("error404", { message: "Unauthorized access to order" });
        }
const reviewedProductOrderMap = new Map();

const reviews = await Review.find({ user:userId}); 

reviews.forEach(review => {
  const key = `${review.product}_${review.order}`;
  reviewedProductOrderMap.set(key, true);
});
const reviewedMapObject = Object.fromEntries(reviewedProductOrderMap);


        res.render("user/orderDetails", {
            user: req.session.user,
            order,
            currentPage: 'orders',
            reviewedProductOrderMap: reviewedMapObject
        });
    } catch (error) {
        console.error("Error loading order details:", error);
        res.status(500).render("error404", { message: "Internal Server Error" });
    }
};

const getOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { id: orderId } = req.params;
        console.log('Fetching order JSON:', { orderId, userId });

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        const order = await Order.findById(orderId).populate('items.productId');
        if (!order || order.user.toString() !== userId) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching order JSON:', error);
        res.status(500).json({ success: false, message: 'Error fetching order' });
    }
};
const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to cancel your order" });
        }

        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (order.user.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized access to order" });
        }

        if (order.orderStatus !== 'Processing') {
            return res.status(400).json({ success: false, message: "Only orders in 'Processing' status can be cancelled" });
        }

        order.orderStatus = 'Cancelled';
        order.paymentStatus = 'Cancelled';
        order.statusHistory.push({
            status: 'Cancelled',
            date: new Date(),
            current: true
        });
        order.statusHistory.forEach(history => {
            if (history !== order.statusHistory[order.statusHistory.length - 1]) {
                history.current = false;
            }
        });

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
        }

        let totalRefund = 0;
        for (const item of order.items) {
            if (item.status === 'Ordered' || item.status === 'Processing') {
                item.status = 'Cancelled';
                item.cancelDate = new Date();

                await Product.findByIdAndUpdate(item.productId, {
                    $inc: { stock: item.quantity }
                }, { new: true });
                const refundAmount = item.finalPrice + (item.tax || 0); 
                totalRefund += refundAmount;

                if (order.paymentMethod === 'Wallet' || order.paymentMethod === 'Online') {
                    wallet.balance += refundAmount;
                    wallet.transactions.push({
                        type: 'credit',
                        amount: refundAmount,
                        description: `Refund for cancelled item: ${item.productName} (${item.quantity} pcs)`,
                        date: new Date()
                    });
                }
            }
        }

        const remainingItems = order.items.filter(item => item.status !== 'Cancelled');
        if (remainingItems.length === 0) {
            order.subtotal = 0;
            order.tax = 0;
            order.totalAmount = 0;
        } else {
            order.subtotal = remainingItems.reduce((sum, item) => sum + item.itemTotal, 0);
            
            const originalSubtotal = order.subtotal + order.items.filter(item => item.status === 'Cancelled').reduce((sum, item) => sum + item.itemTotal, 0);
            const remainingDiscount = (order.subtotal / originalSubtotal) * (order.coupon?.discount || 0);
            
            order.tax = order.subtotal * 0.10; 
            order.totalAmount = Math.max(0, order.subtotal - remainingDiscount + order.shippingFee + order.tax);
        }

        await Promise.all([order.save(), wallet.save()]);
        console.log('Order cancelled:', { orderId, userId, totalRefund });
        res.status(200).json({ success: true, message: "Order cancelled successfully" });
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ success: false, message: "Failed to cancel order: " + error.message });
    }
};
const requestItemAction = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            console.log('No user session');
            return res.status(401).json({ success: false, message: 'Please log in to request this action' });
        }
        const { orderId, productId } = req.params;
        const { action, reason } = req.body;


        if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
            console.log('Invalid ObjectId:', { orderId, productId });
            return res.status(400).json({ success: false, message: 'Invalid order or product ID' });
        }

        if (!['cancel', 'return'].includes(action)) {
            console.log('Invalid action:', action);
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.user.toString() !== userId) {
            console.log('Unauthorized access: User', userId, 'Order user', order.user);
            return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
        }
        const item = order.items.find(i => i.productId._id.toString() === productId.toString());
if (!item) {
    console.log('Item not found:', productId);
    return res.status(404).json({ success: false, message: 'Item not found in order' });
}


        const isCancel = action === 'cancel';
        const expectedOrderStatus = isCancel ? 'Processing' : 'Delivered';
        const expectedItemStatus = isCancel ? ['Ordered', 'Processing'] : ['Delivered'];

        if (order.orderStatus !== expectedOrderStatus) {
            console.log(`Order status invalid for ${action}:`, order.orderStatus);
            return res.status(400).json({ success: false, message: `Order must be in ${expectedOrderStatus} status to ${action}` });
        }

        if (!expectedItemStatus.includes(item.status)) {
            console.log(`Item status invalid for ${action}:`, item.status);
            return res.status(400).json({ success: false, message: `Item must be in ${expectedItemStatus.join(' or ')} status to ${action}` });
        }

        if (isCancel) {
           
            item.status = 'CancelRequested';
            item.cancelRequestDate = new Date();
            item.cancelReason = reason || '';
            item.requestStatus = 'Pending';
        } else {
            
            const deliveredEntry = order.statusHistory.find(h => h.status === 'Delivered');
            const deliveryDate = deliveredEntry ? deliveredEntry.date : order.updatedAt;
            const daysSinceDelivery = (new Date() - new Date(deliveryDate)) / (1000 * 60 * 60 * 24);
            console.log('Return period check:', { deliveryDate, daysSinceDelivery });
            if (daysSinceDelivery > 7) {
                return res.status(400).json({ success: false, message: 'Return period has expired (7 days)' });
            }
            item.status = 'ReturnRequested';
            item.returnReason = reason;
            item.returnRequestDate = new Date();
            item.requestStatus = 'Pending';
        }

        await order.save();
        console.log(`Item ${action} request submitted:`, { orderId, productId, status: item.status, reason });

        return res.status(200).json({
            success: true,
            message: `Item ${isCancel ? 'cancellation' : 'return'} request submitted. Awaiting admin approval.`
        });
    } catch (error) {
        console.error(`Error requesting ${req.body.action || 'action'} for item:`, error);
        return res.status(500).json({ success: false, message: `Internal server error: ${error.message}` });
    }
};

const returnEntireOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            console.log('No user session');
            return res.status(401).json({ success: false, message: 'Please log in to request this action' });
        }

        const { orderId } = req.params;
        const { reason } = req.body;
        console.log('returnEntireOrder called:', { orderId, userId, reason });

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            console.log('Invalid orderId:', orderId);
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        if (!reason || reason.length < 5 || reason.length > 200) {
            console.log('Invalid return reason:', reason);
            return res.status(400).json({ success: false, message: 'Return reason must be 5-200 characters long' });
        }

        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.user.toString() !== userId) {
            console.log('Unauthorized access: User', userId, 'Order user', order.user);
            return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
        }

        if (order.orderStatus !== 'Delivered') {
            console.log('Order status invalid for return:', order.orderStatus);
            return res.status(400).json({ success: false, message: 'Order must be in Delivered status to request return' });
        }

        const deliveredEntry = order.statusHistory.find(h => h.status === 'Delivered');
        const deliveryDate = deliveredEntry ? deliveredEntry.date : order.updatedAt;
        const daysSinceDelivery = (new Date() - new Date(deliveryDate)) / (1000 * 60 * 60 * 24);
        console.log('Return period check:', { deliveryDate, daysSinceDelivery });
        if (daysSinceDelivery > 7) {
            return res.status(400).json({ success: false, message: 'Return period has expired (7 days)' });
        }

        const deliveredItems = order.items.filter(item => item.status === 'Delivered');
        if (deliveredItems.length === 0) {
            console.log('No delivered items to return:', orderId);
            return res.status(400).json({ success: false, message: 'No delivered items available to return' });
        }

        deliveredItems.forEach(item => {
            item.status = 'ReturnRequested';
            item.returnReason = reason;
            item.returnRequestDate = new Date();
            item.requestStatus = 'Pending';
        });

        await order.save();
        console.log('Return request submitted for order:', {
            orderId,
            items: deliveredItems.map(item => ({
                productId: item.productId,
                productName: item.productName,
                status: item.status,
                reason
            }))
        });

        return res.status(200).json({
            success: true,
            message: `Return request for ${deliveredItems.length} item(s) submitted. Awaiting admin approval.`
        });
    } catch (error) {
        console.error('Error requesting return for entire order:', error);
        return res.status(500).json({ success: false, message: `Internal server error: ${error.message}` });
    }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("user", "name email")
      .populate("items.productId", "name");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ❌ Block if payment not completed
    if (order.paymentStatus !== 'Completed') {
      return res.status(403).json({ message: "Invoice not available for unpaid orders." });
    }

    const filePath = path.join(__dirname, `../pdfs/invoice-${orderId}.pdf`);
    await generateInvoicePDF(order, filePath);

    res.download(filePath, `invoice-${orderId}.pdf`, (err) => {
      if (err) {
        console.log("Download error:", err);
      } else {
        fs.unlinkSync(filePath); // Delete after download
      }
    });
  } catch (err) {
    console.error("Invoice error:", err);
    res.status(500).json({ message: "Failed to generate invoice" });
  }
};


module.exports = {
    viewOrderDetail,
    getOrder,
    cancelOrder,
    requestItemAction,
    returnEntireOrder,
    downloadInvoice
};