const Coupon = require('../../Model/coupenSchema');
const mongoose = require('mongoose');

const loadCoupon = async (req, res) => {
  try {
    const admin = req.session.admin;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const totalCoupons = await Coupon.countDocuments();
    const coupons = await Coupon.find().skip((page - 1) * limit).limit(limit);

    res.render('Admin/coupon', {
      coupons,
      page,
      admin,
      limit,
      totalCoupons,
      success: req.flash('success'), 
      error: req.flash('error')      
    });
  } catch (error) {
    console.error('Coupon load error:', error);
    res.status(500).send('Server error');
  }
};


const loadCouponForm = async (req, res) => {
  try {
    const couponId = req.params.id || req.query.id;
    let coupon = null;
    let isEdit = false;

    if (couponId && mongoose.Types.ObjectId.isValid(couponId)) {
      coupon = await Coupon.findById(couponId);
      if (!coupon) {
        req.flash('error', 'Coupon not found');
        return res.redirect('/admin/coupons');
      }
      isEdit = true;
    } else {
      coupon = {
        code: '',
        description: '',
        discountType: 'percentage',
        discountAmount: '',
        maxDiscount: '',
        minPurchase: 0,
        usageLimit: '',
        perUserLimit: 1,
        validFrom: '',
        validUntil: '',
        isActive: true,
        isReferral: false,
      };
    }

    res.render('Admin/addCoupon', {
      isEdit,
      coupon,
      error: req.flash('error') || null,
      errors: {},
      title: isEdit ? 'Edit Coupon' : 'Add Coupon',
    });
  } catch (error) {
    console.error('Error loading coupon form:', error);
    req.flash('error', 'Error loading coupon form');
    res.redirect('/admin/coupons');
  }
};

const couponAdd = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountAmount,
      maxDiscount,
      minPurchase,
      usageLimit,
      perUserLimit,
      validFrom,
      validUntil,
      isActive,
      isReferral,
    } = req.body;

    const errors = {};
    let hasErrors = false;

    if (!code || !code.trim()) {
      errors.code = 'Coupon code is required';
      hasErrors = true;
    } else if (code.length < 3) {
      errors.code = 'Coupon code must be at least 3 characters';
      hasErrors = true;
    }

    if (!discountType) {
      errors.discountType = 'Discount type is required';
      hasErrors = true;
    }

    if (!discountAmount || isNaN(discountAmount) || parseFloat(discountAmount) <= 0) {
      errors.discountAmount = 'Please enter a valid discount amount';
      hasErrors = true;
    }

    if (discountType === 'percentage' && (!maxDiscount || isNaN(maxDiscount) || parseFloat(maxDiscount) <= 0)) {
      errors.maxDiscount = 'Please enter a valid maximum discount amount for percentage discounts';
      hasErrors = true;
    }

    if (minPurchase && (isNaN(minPurchase) || parseFloat(minPurchase) < 0)) {
      errors.minPurchase = 'Please enter a valid minimum purchase amount';
      hasErrors = true;
    }

    if (usageLimit && (isNaN(usageLimit) || parseInt(usageLimit) <= 0)) {
      errors.usageLimit = 'Please enter a valid usage limit';
      hasErrors = true;
    }

    if (!perUserLimit || isNaN(perUserLimit) || parseInt(perUserLimit) <= 0) {
      errors.perUserLimit = 'Please enter a valid per user limit';
      hasErrors = true;
    }

    if (!validFrom) {
      errors.validFrom = 'Valid from date is required';
      hasErrors = true;
    }

    if (!validUntil) {
      errors.validUntil = 'Valid until date is required';
      hasErrors = true;
    } else if (new Date(validUntil) <= new Date(validFrom)) {
      errors.validUntil = 'Valid until must be after valid from date';
      hasErrors = true;
    }

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      errors.code = 'This coupon code already exists';
      hasErrors = true;
    }

    if (hasErrors) {
      return res.render('Admin/addCoupon', {
        isEdit: false,
        coupon: req.body,
        errors,
        error: 'Please correct the errors below',
        title: 'Add Coupon',
      });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      description,
      discountType,
      discountAmount: parseFloat(discountAmount),
      maxDiscount: discountType === 'percentage' ? parseFloat(maxDiscount) : null,
      minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      perUserLimit: parseInt(perUserLimit),
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      isActive: isActive === 'on' || isActive === true,
      isReferral: isReferral === 'on' || isReferral === true,
    });

    await newCoupon.save();
    req.flash('success', 'Coupon added successfully');
    res.redirect('/admin/coupons');
  } catch (error) {
    console.error('Error adding coupon:', error);
    req.flash('error', 'Error adding coupon');
    res.render('Admin/addCoupon', {
      isEdit: false,
      coupon: req.body,
      errors: {},
      error: 'Error adding coupon',
      title: 'Add Coupon',
    });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    console.log(`[DELETE] Received request for coupon ID: ${couponId}`);

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      console.warn(`[DELETE] Invalid coupon ID: ${couponId}`);
      return res.status(400).json({ success: false, message: 'Invalid coupon ID' });
    }

    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);
    if (!deletedCoupon) {
      console.warn(`[DELETE] Coupon not found for ID: ${couponId}`);
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    console.log(`[DELETE] Coupon deleted successfully: ${couponId}`);
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error(`[DELETE] Error deleting coupon: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting coupon',
      error: error.message,
    });
  }
};

const loadEditCouponForm = async (req, res) => {
  try {
    const couponId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      req.flash('error', 'Invalid coupon ID');
      return res.redirect('/admin/coupons');
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      req.flash('error', 'Coupon not found');
      return res.redirect('/admin/coupons');
    }

    res.render('Admin/addCoupon', {
      title: 'Edit Coupon',
      coupon,
      isEdit: true,
      error: req.flash('error') || null,
      errors: {},
    });
  } catch (error) {
    console.error('Error loading edit coupon form:', error);
    req.flash('error', 'Error loading coupon form');
    res.redirect('/admin/coupons');
  }
};

const editCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountAmount,
      maxDiscount,
      minPurchase,
      usageLimit,
      perUserLimit,
      validFrom,
      validUntil,
      isActive,
      isReferral,
    } = req.body;

    const errors = {};
    let hasErrors = false;

    if (!code || !code.trim()) {
      errors.code = 'Coupon code is required';
      hasErrors = true;
    } else if (code.length < 3) {
      errors.code = 'Coupon code must be at least 3 characters';
      hasErrors = true;
    }

    if (!discountType) {
      errors.discountType = 'Discount type is required';
      hasErrors = true;
    }

    if (!discountAmount || isNaN(discountAmount) || parseFloat(discountAmount) <= 0) {
      errors.discountAmount = 'Please enter a valid discount amount';
      hasErrors = true;
    }

    if (discountType === 'percentage' && (!maxDiscount || isNaN(maxDiscount) || parseFloat(maxDiscount) <= 0)) {
      errors.maxDiscount = 'Please enter a valid maximum discount amount for percentage discounts';
      hasErrors = true;
    }

    if (minPurchase && (isNaN(minPurchase) || parseFloat(minPurchase) < 0)) {
      errors.minPurchase = 'Please enter a valid minimum purchase amount';
      hasErrors = true;
    }

    if (usageLimit && (isNaN(usageLimit) || parseInt(usageLimit) <= 0)) {
      errors.usageLimit = 'Please enter a valid usage limit';
      hasErrors = true;
    }

    if (!perUserLimit || isNaN(perUserLimit) || parseInt(perUserLimit) <= 0) {
      errors.perUserLimit = 'Please enter a valid per user limit';
      hasErrors = true;
    }

    if (!validFrom) {
      errors.validFrom = 'Valid from date is required';
      hasErrors = true;
    }

    if (!validUntil) {
      errors.validUntil = 'Valid until date is required';
      hasErrors = true;
    } else if (new Date(validUntil) <= new Date(validFrom)) {
      errors.validUntil = 'Valid until must be after valid from date';
      hasErrors = true;
    }

    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase(),
      _id: { $ne: req.params.id },
    });
    if (existingCoupon) {
      errors.code = 'This coupon code already exists';
      hasErrors = true;
    }

    if (hasErrors) {
      return res.render('Admin/addCoupon', {
        title: 'Edit Coupon',
        coupon: req.body,
        isEdit: true,
        errors,
        error: 'Please correct the errors below',
      });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        code: code.toUpperCase(),
        description,
        discountType,
        discountAmount: parseFloat(discountAmount),
        maxDiscount: discountType === 'percentage' ? parseFloat(maxDiscount) : null,
        minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        perUserLimit: parseInt(perUserLimit),
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        isActive: isActive === 'on' || isActive === true,
        isReferral: isReferral === 'on' || isReferral === true,
      },
      { new: true, runValidators: true }
    );

    if (!updatedCoupon) {
      req.flash('error', 'Coupon not found');
      return res.redirect('/admin/coupons');
    }

    req.flash('success', 'Coupon updated successfully');
    res.redirect('/admin/coupons');
  } catch (error) {
    console.error('Error updating coupon:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = {};
      Object.keys(error.errors).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });
      return res.render('Admin/addCoupon', {
        title: 'Edit Coupon',
        coupon: req.body,
        isEdit: true,
        errors: validationErrors,
        error: 'Please correct the errors below',
      });
    }
    req.flash('error', 'An error occurred while updating the coupon');
    res.redirect('/admin/coupons');
  }
};

const toggleStatus = async (req, res) => {
  try {
    const couponId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon ID' });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({ success: true, message: 'Coupon status updated' });
  } catch (error) {
    console.error('Error toggling coupon status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling coupon status',
      error: error.message,
    });
  }
};

module.exports = {
  loadCoupon,
  loadCouponForm,
  couponAdd,
  deleteCoupon,
  loadEditCouponForm,
  editCoupon,
  toggleStatus,
};