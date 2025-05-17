const User = require("../../Model/userSchema");
const Wallet = require("../../Model/walletSchema");
const Address = require("../../Model/addressSchema");
const Cart = require("../../Model/cartSchema");
const Order = require("../../Model/orderSchema");
const Product = require("../../Model/productSchema");
const Wishlist = require("../../Model/wishlistSchema");
const { v4: uuidv4 } = require('uuid');

const totalSubtotal = (items) => {
    console.log('Calculating subtotal for items:', items);
    const subtotal = items.reduce((total, item) => {
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || (item.product && Number(item.product.salePrice)) || 0;
        console.log(`Item: ${item.product?.name}, Quantity: ${quantity}, Price: ${price}`);
        return total + quantity * price;
    }, 0);
    return subtotal;
};

const calculateTax = (subtotal) => {
    const tax = subtotal * 0.10;
    console.log('Tax (10%):', tax);
    return tax;
};

const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            console.log('No user session found');
            return res.status(401).render("error404", { message: "Please log in to checkout" });
        }
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found');
            return res.status(404).render("error404", { message: "User not found" });
        }

        let cart = await Cart.findOne({ userId }).populate("items.product");
        console.log('Cart:', cart);

        if (!cart) {
            console.log('No cart found, creating a new one');
            cart = new Cart({ userId, items: [] });
            await cart.save();
        }

        cart.items = cart.items.filter(item => {
            if (item.product && !item.product.isDeleted && !item.product.isBlocked && item.product.status === 'available' && item.product.stock >= item.quantity) {
                return true;
            }
            console.log(`Removing invalid item: ${item.product?.name}`);
            return false;
        });
        await cart.save();

        if (cart.items.length === 0) {
            console.log('No valid items in cart, redirecting to cart page');
            return res.redirect('/cart');
        }

        const addresses = await Address.find({ userId });
        let selectedAddress = addresses.find(addr => addr.isDefault) || addresses[0] || null;

        const wallet = await Wallet.findOne({ userId }) || { balance: 0 };


        const subtotal = totalSubtotal(cart.items);
        const shippingFee = 10;
        const tax = calculateTax(subtotal);
        const totalAmount = subtotal + shippingFee + tax;

        res.render("user/checkOut", {
            user,
            cart,
            addresses,
            selectedAddress,
            selectedAddressId: selectedAddress ? selectedAddress._id.toString() : '',
            walletBalance: wallet.balance,
            subtotal,
            shippingFee,
            tax,
            totalAmount,
        });
    } catch (error) {
        console.error("Render checkout error:", error);
        res.status(500).render("error404", { message: "Internal Server Error" });
    }
};

const getAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        console.log('Fetching address for user:', userId, 'Address ID:', req.params.addressId);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const address = await Address.findOne({ _id: req.params.addressId, userId });
        if (!address) {
            return res.status(404).json({ message: "Address not found" });
        }
        res.json(address);
    } catch (error) {
        console.error("Get address error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod } = req.body;
        const userId = req.session.user?._id;

        console.log('Place order request:', { addressId, paymentMethod, userId });

        if (!userId) {
            console.log('User not logged in');
            return res.status(401).json({ success: false, message: 'Please log in to place an order' });
        }

        if (!addressId || !['COD', 'Online', 'Wallet'].includes(paymentMethod)) {
            console.log('Invalid address or payment method');
            return res.status(400).json({ success: false, message: 'Valid address and payment method are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const cart = await Cart.findOne({ userId }).populate("items.product");
        if (!cart || cart.items.length === 0) {
            console.log('Cart is empty or not found');
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        const address = await Address.findById(addressId);
        if (!address) {
            console.log('Address not found');
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        cart.items = cart.items.filter(item => {
            const product = item.product;
            if (product && !product.isDeleted && !product.isBlocked && product.status === "available") {
                return true;
            }
            console.log(`Filtered out invalid item: ${item.product?.name}`);
            return false;
        });

        for (const item of cart.items) {
            if (item.product.stock < item.quantity) {
                console.log(`Insufficient stock for ${item.product.name}`);
                return res.status(400).json({ success: false, message: `Insufficient stock for ${item.product.name}` });
            }
        }

        const subtotal = totalSubtotal(cart.items);
        const shippingFee = 10;
        const tax = calculateTax(subtotal);
        const totalAmount = subtotal + shippingFee + tax;
        const orderId = `ORD-${uuidv4().slice(0, 8)}`;


        if (paymentMethod === 'Wallet') {
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = new Wallet({ userId, balance: 0, transactions: [] });
            }
            if (wallet.balance < totalAmount) {
                console.log('Insufficient wallet balance:', wallet.balance, 'Required:', totalAmount);
                return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
            }
            wallet.balance -= totalAmount;
            wallet.transactions.push({
                type: 'debit',
                amount: totalAmount,
                description: `Payment for order ${orderId}`,
                date: new Date()
            });
            await wallet.save();
        }

        const order = new Order({
            orderId,
            user: userId,
            items: cart.items.map(item => ({
                productId: item.product._id,
                productName: item.product.name,
                quantity: item.quantity,
                price: item.price || item.product.salePrice || 0,
                status: 'Ordered'
            })),
            subtotal,
            discount: 0,
            shippingFee,
            tax,
            totalAmount,
            shippingAddress: {
                fullName: address.fullName,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2 || '',
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: address.country,
                phone: address.phone,
                addressType: address.addressType || "home",
                landmark: address.landmark || ''
            },
            orderDate: new Date(),
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            paymentMethod,
            paymentStatus: paymentMethod === 'Wallet' ? 'Completed' : 'Pending',
            orderStatus: 'Processing',
            statusHistory: [{
                status: 'Processing',
                date: new Date(),
                current: true
            }]
        });

        await order.save();

        for (const item of cart.items) {
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { stock: -item.quantity }
            });
        }

        const purchasedProductIds = cart.items.map(item => item.product._id);
        console.log('Removing purchased products from wishlist:', purchasedProductIds);
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId: { $in: purchasedProductIds } } } }
        );

        await Cart.findOneAndUpdate({ userId }, { items: [] });

        res.status(200).json({ success: true, orderId: order._id });
    } catch (error) {
        console.error('Place order error:', error);
        res.status(500).json({ success: false, message: `Failed to place order: ${error.message}` });
    }
};

const loadSuccess = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            console.log('No user session found');
            return res.status(401).render("error404", { message: "Please log in to view order confirmation" });
        }

        const { orderId } = req.query;
        if (!orderId) {
            console.log('No orderId provided');
            return res.status(400).render("error404", { message: "Order ID not provided" });
        }

        const order = await Order.findById(orderId).populate("items.productId");
        if (!order) {
            console.log('Order not found');
            return res.status(404).render("error404", { message: "Order not found" });
        }

        if (order.user.toString() !== userId) {
            console.log('Unauthorized access to order');
            return res.status(403).render("error404", { message: "Unauthorized access to order" });
        }


        res.render("user/ordercomplition", {
            order: {
                _id: order.orderId,
                paymentMethod: order.paymentMethod,
                items: order.items.map(item => ({
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price
                })),
                subtotal: order.subtotal,
                shippingFee: order.shippingFee,
                tax: order.tax,
                totalAmount: order.totalAmount,
                address: {
                    name: order.shippingAddress.fullName,
                    address: order.shippingAddress.addressLine1 + (order.shippingAddress.addressLine2 ? ", " + order.shippingAddress.addressLine2 : ""),
                    city: order.shippingAddress.city,
                    state: order.shippingAddress.state,
                    country: order.shippingAddress.country,
                    zipCode: order.shippingAddress.postalCode,
                    phone: order.shippingAddress.phone
                }
            }
        });
    } catch (error) {
        console.error("Rendering order confirmation error:", error);
        res.status(500).render("error404", { message: "Internal Server Error" });
    }
};

module.exports = {
    loadCheckout,
    getAddress,
    placeOrder,
    loadSuccess
};
