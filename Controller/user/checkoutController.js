const User = require("../../Model/userSchema");
const Wallet = require("../../Model/walletSchema");
const Address = require("../../Model/addressSchema");
const Cart = require("../../Model/cartSchema");
const Order = require("../../Model/orderSchema");
const Product = require("../../Model/productSchema");
const Wishlist = require("../../Model/wishlistSchema");
const Coupon = require('../../Model/coupenSchema')
const Brand = require('../../Model/brandschema')
const Category = require('../../Model/categorySchema')
const dotenv = require("dotenv").config()
const { v4: uuidv4 } = require('uuid');

const totalSubtotal = (items) => {
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
    return tax;
};

const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      console.log("No user session found");
      return res
        .status(401)
        .render("error404", { message: "Please log in to checkout" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found");
      return res.status(404).render("error404", { message: "User not found" });
    }

    let cart = await Cart.findOne({ userId }).populate({
      path: "items.product",
      populate: [
        { path: "brand", select: "isListed" },
        { path: "category", select: "isListed" },
      ],
    });

    const availableCoupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!cart) {
      console.log("No cart found, creating a new one");
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }

    let removedProducts = [];

    cart.items = cart.items.filter((item) => {
      const product = item.product;
      if (
        product &&
        !product.isDeleted &&
        product.isListed &&
        product.status === "available" &&
        product.stock >= item.quantity &&
        product.brand?.isListed !== false &&
        product.category?.isListed !== false
      ) {
        return true;
      }

      removedProducts.push(product?.name || "Unknown Product");
      return false;
    });

    let stockWarning = null;
    if (removedProducts.length > 0) {
      stockWarning = `The following items were removed from your cart: ${removedProducts.join(
        ", "
      )}`;
    }
        const addresses = await Address.find({ userId });
    const selectedAddress =
      addresses.find((addr) => addr.isDefault) || addresses[0] || null;
    const couponDiscount = cart.coupon?.discount || 0;
    const wallet = (await Wallet.findOne({ userId })) || { balance: 0 };

    const subtotal = totalSubtotal(cart.items);
    const shippingFee = 10;
    const tax = calculateTax(subtotal);
    const totalAmount = subtotal + shippingFee + tax - couponDiscount;

      res.render("user/checkOut", {
        stockWarning,
      user,
      cart,
      addresses,
      selectedAddress,
      selectedAddressId: selectedAddress ? selectedAddress._id.toString() : "",
      walletBalance: wallet.balance,
      subtotal,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      shippingFee,
      tax,
      totalAmount,
      availableCoupons,
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
  let orderData;
  try {
    const { addressId, paymentMethod } = req.body;
    const userId = req.session.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Please log in to place an order" });
    }

    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.product",
      populate: ["brand", "category"],
    });
    const address = await Address.findById(addressId);

    if (
      !user ||
      !cart ||
      cart.items.length === 0 ||
      !address ||
      address.userId.toString() !== userId
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User, cart, or address not found, empty, or unauthorized",
        });
    }

    let removedProducts = [];

    cart.items = cart.items.filter((item) => {
      const p = item.product;
      if (
        p &&
        !p.isDeleted &&
        p.isListed !== false &&
        p.status === "available" &&
        p.stock >= item.quantity &&
        p.brand?.isListed !== false &&
        p.category?.isListed !== false
      ) {
        return true;
      }
      removedProducts.push(p?.name || "Unknown Product");
      return false;
    });

    if (cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: `The following items were removed from your cart due to stock or availability issues: ${removedProducts.join(
          ", "
        )}`,
      });
    }

    let total = 0;
    cart.items.forEach((item) => {
      if (item.product?.salePrice) {
        total += item.product.salePrice * item.quantity;
      }
    });

    let couponDiscount = 0;
    let appliedCoupon = null;

    if (cart.coupon?.code?.trim()) {
      const coupon = await Coupon.findOne({
        code: cart.coupon.code,
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      });

      if (!coupon) {
        cart.coupon = null;
        await cart.save();
      } else {
        if (coupon.minPurchase && total < coupon.minPurchase) {
          return res.status(400).json({
            success: false,
            message: `Minimum purchase of ₹${coupon.minPurchase} required`,
          });
        }

        const userUsage = await Order.countDocuments({
          user: userId,
          "coupon.code": cart.coupon.code,
        });
        if (coupon.perUserLimit && userUsage >= coupon.perUserLimit) {
          return res
            .status(400)
            .json({
              success: false,
              message: "You have reached the usage limit for this coupon",
            });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          return res
            .status(400)
            .json({ success: false, message: "Coupon usage limit exceeded" });
        }

        if (coupon.discountType === "percentage") {
          couponDiscount = (coupon.discountAmount / 100) * total;
          if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
            couponDiscount = coupon.maxDiscount;
          }
        } else {
          couponDiscount = coupon.discountAmount;
        }

        if (couponDiscount > total) {
          couponDiscount = total;
        }

        appliedCoupon = coupon;
      }
    }
    

    const subtotal = totalSubtotal(cart.items);
    const shippingFee = 10;
    const tax = calculateTax(subtotal);
    const totalAmount = Math.max(
      0,
      subtotal + shippingFee + tax - couponDiscount
    );

    if (paymentMethod === "COD" && totalAmount > 1000) {
      return res.status(400).json({
        success: false,
        message: "Cash on Delivery is not available for orders above ₹1000",
      });
    }

    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Insufficient stock for ${item.product.name}`,
          });
      }
    }

    const orderId = `ORD-${uuidv4().slice(0, 8)}`;

    const itemsWithDiscountAndTax = cart.items.map((item) => {
      const itemTotal =
        (item.price || item.product.salePrice || 0) * item.quantity;
      const itemDiscount =
        subtotal > 0 ? (itemTotal / subtotal) * couponDiscount : 0;
      const itemFinalPrice = itemTotal - itemDiscount;
      const itemTax = subtotal > 0 ? (itemTotal / subtotal) * tax : 0;

      return {
        productId: item.product._id,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price || item.product.salePrice || 0,
        itemTotal,
        discount: itemDiscount,
        tax: itemTax,
        finalPrice: itemFinalPrice,
        status: "Ordered",
      };
    });

    orderData = {
      orderId,
      user: userId,
      items: itemsWithDiscountAndTax,
      subtotal,
      discount: couponDiscount,
      shippingFee,
      tax,
      coupon: {
        code: appliedCoupon?.code || null,
        discount: couponDiscount,
      },
      totalAmount,
      shippingAddress: {
        fullName: address.fullName,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || "",
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        phone: address.phone,
        addressType: address.addressType || "home",
        landmark: address.landmark || "",
      },
      orderDate: new Date(),
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      paymentMethod,
      paymentStatus: "Pending",
      orderStatus: "Pending",
      statusHistory: [
        {
          status: "Pending",
          date: new Date(),
          current: true,
        },
      ],
    };

    if (paymentMethod === "Online") {
      const order = new Order(orderData);
      await order.save();
      return res
        .status(200)
        .json({ success: true, orderId: order._id, totalAmount });
    }

    if (paymentMethod === "Wallet") {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
      }
      if (wallet.balance < totalAmount) {
        return res
          .status(400)
          .json({ success: false, message: "Insufficient wallet balance" });
      }

      wallet.balance -= totalAmount;
      wallet.transactions.push({
        type: "debit",
        amount: totalAmount,
        description: `Payment for order ${orderId}`,
        date: new Date(),
      });
      await wallet.save();
      orderData.paymentStatus = "Completed";
      orderData.orderStatus = "Processing";
      orderData.statusHistory[0].status = "Processing";
    }

    const order = new Order(orderData);
    if (paymentMethod === "COD") {
      order.paymentStatus = "Pending";
      order.orderStatus = "Processing";
      order.statusHistory[0].status = "Processing";
    }

    await order.save();

    if (appliedCoupon) {
      appliedCoupon.usedCount = (appliedCoupon.usedCount || 0) + 1;
      await appliedCoupon.save();
    }

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity },
      });
    }

    const purchasedProductIds = cart.items.map((item) => item.product._id);
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId: { $in: purchasedProductIds } } } }
    );

    await Cart.findOneAndUpdate({ userId }, { items: [], coupon: null });

    return res.status(200).json({ success: true, orderId: order._id });
  } catch (error) {
    console.error("Place order error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: `Failed to place order: ${error.message}`,
      });
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


const loadFailed = async (req, res) => {
    try {
        res.render('user/order-failed', { errorMessage: req.query.message || '' });
    } catch (error) {

    }
}

module.exports = {
    loadCheckout,
    getAddress,
    placeOrder,
    loadSuccess,
    loadFailed
}; 