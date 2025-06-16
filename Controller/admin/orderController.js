const mongoose = require('mongoose');
const Order = require("../../Model/orderSchema");
const Product = require("../../Model/productSchema");
const User = require("../../Model/userSchema");
const Wallet = require("../../Model/walletSchema");


const loadAdminOrder = async (req, res) => {
    try {
        const search = req.query.query ? req.query.query.trim() : '';
        const page = parseInt(req.query.page) || 1;
        const limit = 20;

        if (page < 1) {
            return res.status(400).render('Admin/error404', { error: 'Invalid page number' });
        }

        const baseFilter = {
            $nor: [{ paymentMethod: 'Online', paymentStatus: 'Pending' }]
        };

        const userMatches = await User.find({
            name: { $regex: new RegExp(search, 'i') }
        }).select('_id');

        const query = {
            ...baseFilter,
            ...(search && {
                $or: [
                    ...(mongoose.Types.ObjectId.isValid(search) ? [{ _id: search }] : []),
                    ...(userMatches.length > 0 ? [{ user: { $in: userMatches.map(u => u._id) } }] : [])
                ]
            })
        };

        const orderData = await Order.find(query)
            .populate('user')
            .sort({ orderDate: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const count = await Order.countDocuments(query);

        const admin = req.session.admin;

        res.status(200).render('Admin/OrderManagement', {
            admin,
            orders: orderData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            activePage: 'orders',
            search
        });
    } catch (error) {
        console.error('Error loading admin orders:', error);
        res.status(500).render('error404', { message: 'Internal Server Error' });
    }
};


const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        console.log('Updating order:', id, 'New status:', status);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log('Invalid order ID:', id);
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        const order = await Order.findById(id).populate('user');
        if (!order) {
            console.log('Order not found:', id);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        console.log('Current order:', { orderStatus: order.orderStatus, items: order.items.map(item => ({ productId: item.productId, status: item.status })) });

        const validStatus = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatus.includes(status)) {
            console.log('Invalid status:', status);
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        if (order.orderStatus === 'Delivered' || order.orderStatus === 'Cancelled') {
            console.log(`Cannot change status from ${order.orderStatus}`);
            return res.status(400).json({
                success: false,
                message: `Cannot change status of an order that is already ${order.orderStatus}`
            });
        }

        let itemsUpdated = false;
        if (status === 'Processing') {
            order.items.forEach(item => {
                if (item.status === 'Ordered') {
                    item.status = 'Processing';
                    itemsUpdated = true;
                }
            });
        } else if (status === 'Shipped') {
            order.items.forEach(item => {
                if (item.status === 'Ordered' || item.status === 'Processing') {
                    item.status = 'Processing';
                    itemsUpdated = true;
                }
            });
        } else if (status === 'Delivered') {
            order.items.forEach(item => {
                if (item.status === 'Ordered' || item.status === 'Processing') {
                    item.status = 'Delivered';
                    itemsUpdated = true;
                }
            });
        } else if (status === 'Cancelled') {
            let wallet = await Wallet.findOne({ userId: order.user._id });
            if (!wallet) {
                wallet = new Wallet({ userId: order.user._id, balance: 0, transactions: [] });
            }

            for (const item of order.items) {
                if (item.status === 'Ordered' || item.status === 'Processing') {
                    await Product.findByIdAndUpdate(item.productId, {
                        $inc: { stock: item.quantity }
                    }, { new: true });

                    item.status = 'Cancelled';
                    item.cancelDate = new Date();
                    itemsUpdated = true;
                    console.log('Restocked and cancelled item:', item.productId, 'Quantity:', item.quantity);

                    if (order.paymentMethod === 'Wallet' || order.paymentMethod === 'Online') {
                        const refundAmount = item.finalPrice + (item.tax || 0);
                        wallet.balance += refundAmount + 10;
                        wallet.transactions.push({
                            type: 'credit',
                            amount: refundAmount + 10,
                            description: `Refund for cancelled item: ${item.productName} (${item.quantity} pcs)`,
                            date: new Date()
                        });
                        console.log(`Refunded ${refundAmount} to wallet for item ${item.productId}`);
                    }
                }
            }
            await wallet.save();
        }

        if (itemsUpdated) {
            console.log(`Updated item statuses to ${status} for order:`, id);
        } else {
            console.log('No items updated (already in target or other statuses)');
        }

        order.orderStatus = status;
        order.statusHistory = order.statusHistory || [];
        order.statusHistory.push({
            status,
            date: new Date(),
            current: true
        });
        order.statusHistory.forEach(history => {
            if (history !== order.statusHistory[order.statusHistory.length - 1]) {
                history.current = false;
            }
        });

        await order.save();
        console.log('Order saved:', { orderStatus: order.orderStatus, items: order.items.map(item => ({ productId: item.productId, status: item.status })) });

        res.status(200).json({ success: true, message: 'Order updated successfully' });
    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
};

const loadRequstManagement = async (req, res) => {
    try {
        const orders = await Order.find({
            'items': {
                $elemMatch: {
                    status: { $in: ['CancelRequested', 'ReturnRequested'] },
                    requestStatus: 'Pending'
                }
            }
        }).populate('items.productId').populate('user');

        const requests = orders.flatMap(order => {
            const user = order.user || {};
            const customerName = user.name || user.email || 'Unknown';
            return order.items
                .filter(item => ['CancelRequested', 'ReturnRequested'].includes(item.status) && item.requestStatus === 'Pending')
                .map(item => ({
                    orderId: order._id,
                    productId: item.productId,
                    productName: item.productName,
                    action: item.status === 'CancelRequested' ? 'cancel' : 'return',
                    reason: item.status === 'ReturnRequested' ? (item.returnReason || 'N/A') : (item.cancelReason || 'No reason provided'),
                    requestDate: item.cancelRequestDate || item.returnRequestDate,
                    customerName
                }));
        });

        const admin = req.session.admin

        console.log('Loaded requests:', requests.length);
        res.render('Admin/adminRequests', { admin, requests, activePage: 'requests' });
    } catch (error) {
        console.error("Error loading request management:", error);
        res.status(500).render("error404", { message: 'Internal Server Error' });
    }
};

const loadOrders = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log('Invalid order ID:', id);
            return res.status(400).render('error404', { message: 'Invalid order ID' });
        }

        const order = await Order.findById(id).populate('user').populate('items.productId');
        if (!order) {
            console.log("Order not found:", id);
            return res.status(404).render('error404', { message: 'Order not found' });
        }
        res.render("Admin/orderDetail", {
            order,
            activePage: "orders"
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        res.status(500).render('error404', { message: 'Error loading orders' });
    }
};

const adminHandleRequest = async (req, res) => {
    try {
        const { orderId, productId, action, approve } = req.body;
        console.log('adminHandleRequest called:', { orderId, productId, action, approve });

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            console.log('Invalid orderId:', orderId);
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        const productIdStr = typeof productId === 'object' && productId._id ? productId._id : productId;

        if (!mongoose.Types.ObjectId.isValid(productIdStr)) {
            console.log('Invalid productId:', productIdStr);
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        if (!['cancel', 'return'].includes(action)) {
            console.log('Invalid action:', action);
            return res.status(400).json({ success: false, message: 'Invalid action specified' });
        }

        const order = await Order.findById(orderId)
            .populate('items.productId')
            .populate('user');
        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.items.find(i => i.productId._id.toString() === productIdStr);
        if (!item) {
            console.log('Item not found in order:', productIdStr);
            return res.status(404).json({ success: false, message: 'Item not found in order' });
        }

        const isCancel = action === 'cancel';
        const expectedStatus = isCancel ? 'CancelRequested' : 'ReturnRequested';

        if (item.status !== expectedStatus || item.requestStatus !== 'Pending') {
            console.log('Invalid item or request status:', { itemStatus: item.status, requestStatus: item.requestStatus });
            return res.status(400).json({
                success: false,
                message: `Item is not in ${expectedStatus} status or request is not pending`
            });
        }

        const product = await Product.findById(item.productId);
        if (!product && approve) {
            console.log('Product not found for restocking:', item.productId);
            return res.status(404).json({ success: false, message: 'Product not found for restocking' });
        }

        let wallet = await Wallet.findOne({ userId: order.user._id });
        if (!wallet) {
            wallet = new Wallet({ userId: order.user._id, balance: 0, transactions: [] });
            console.log('Created new wallet for user:', order.user._id);
        }

        let refundAmount = (item.itemTotal || 0) + (item.tax || 0);

        const orderDiscount = order.discount || 0;
        const totalItemValue = order.items.reduce((sum, i) => sum + i.itemTotal, 0);
        const itemDiscountShare = totalItemValue > 0
            ? (item.itemTotal / totalItemValue) * orderDiscount
            : 0;

        refundAmount = refundAmount - itemDiscountShare;

        refundAmount = Math.max(Math.round(refundAmount), 0);
        console.log('Refund amount calculated with proportional discount:', refundAmount);


        if (approve) {
            if (isCancel) {
                item.status = 'Cancelled';
                item.cancelDate = new Date();
                item.requestStatus = 'Approved';
                item.cancelRequestDate = null;
                item.cancelReason = item.cancelReason || '';

                await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } }, { new: true });
                console.log('Restocked item:', item.productId, 'Quantity:', item.quantity);

                if (order.paymentMethod === 'Wallet' || order.paymentMethod === 'Online') {
                    console.log('Crediting refund to wallet. Previous balance:', wallet.balance);
                    wallet.balance += refundAmount;
                    wallet.transactions.push({
                        type: 'credit',
                        amount: refundAmount,
                        description: `Refund for cancelled item: ${item.productName} (${item.quantity} pcs)`,
                        date: new Date()
                    });
                    console.log('Refund credited. New wallet balance:', wallet.balance);
                } else {
                    console.log('No refund credited due to payment method:', order.paymentMethod);
                }
            } else {
                item.status = 'Returned';
                item.returnDate = new Date();
                item.requestStatus = 'Approved';
                item.returnRequestDate = null;

                await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } }, { new: true });
                console.log('Restocked item:', item.productId, 'Quantity:', item.quantity);

                if (['Wallet', 'Online', 'COD'].includes(order.paymentMethod)) {
                    console.log('Crediting refund to wallet. Previous balance:', wallet.balance);
                    wallet.balance += refundAmount;
                    wallet.transactions.push({
                        type: 'credit',
                        amount: refundAmount,
                        description: `Refund for returned item: ${item.productName} (${item.quantity} pcs)`,
                        date: new Date()
                    });
                    console.log('Refund credited. New wallet balance:', wallet.balance);
                } else {
                    console.log('No refund credited due to payment method:', order.paymentMethod);
                }
            }
        } else {
            item.requestStatus = 'Rejected';
            item.status = isCancel ? 'Processing' : 'Delivered';
            item.cancelRequestDate = null;
            item.returnRequestDate = null;
            item.cancelReason = '';
            item.returnReason = '';
            console.log('Request rejected, reset item status:', { productId: item.productId, newStatus: item.status });
        }

        const activeItems = order.items.filter(i => i.status !== 'Returned' && i.status !== 'Cancelled');
        order.subtotal = activeItems.reduce((sum, i) => sum + i.itemTotal, 0);
        order.tax = Math.round(order.subtotal * 0.10);

        const totalItemValueBeforeDiscount = order.items.reduce((sum, i) => sum + i.itemTotal, 0);
        const proportionalDiscount = totalItemValueBeforeDiscount > 0
            ? (order.discount || 0) * (order.subtotal / totalItemValueBeforeDiscount)
            : 0;

        order.totalAmount = Math.round(order.subtotal + order.tax + order.shippingFee - proportionalDiscount);

        console.log('Recalculated order totals:', {
            subtotal: order.subtotal,
            tax: order.tax,
            totalAmount: order.totalAmount
        });

        const allItemsProcessed = order.items.every(i => i.status === 'Returned' || i.status === 'Cancelled');
        if (allItemsProcessed) {
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
            console.log('All items processed, order cancelled:', { orderId, orderStatus: order.orderStatus });
        }

        await Promise.all([order.save(), wallet.save()]);
        console.log(`Item ${action} request ${approve ? 'approved' : 'rejected'} successfully`, {
            orderId,
            productId: item.productId,
            itemStatus: item.status,
            orderStatus: order.orderStatus,
            subtotal: order.subtotal,
            totalAmount: order.totalAmount,
            walletBalance: wallet.balance
        });

        return res.status(200).json({
            success: true,
            message: `Item ${action} request ${approve ? 'approved' : 'rejected'}`
        });

    } catch (error) {
        console.error(`Error handling ${req.body.action || 'action'} request:`, error);
        return res.status(500).json({ success: false, message: `Internal server error: ${error.message}` });
    }
};


module.exports = {
    loadAdminOrder,
    updateOrder,
    loadOrders,
    loadRequstManagement,
    adminHandleRequest
};