const Review = require('../../Model/review');
const Order = require('../../Model/orderSchema');

const submitReview = async (req, res) => {
  try {
    const { orderId, productId, rating, comment } = req.body;
    const userId = req.session.user._id;

    if (!orderId || !productId || !rating || !comment) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.orderStatus !== 'Delivered') {
      return res.status(400).json({ message: 'Reviews can only be submitted for delivered orders' });
    }

    const item = order.items.find(
      (item) => item.productId.toString() === productId && item.status === 'Delivered'
    );
    if (!item) {
      return res.status(400).json({ message: 'Product not found in order or not delivered' });
    }

    const existingReview = await Review.findOne({ user: userId, product: productId, order: orderId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product for this order' });
    }

    const review = await Review.create({
      user: userId,
      product: productId,
      order: orderId,
      rating,
      comment,
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully.',
      review,
    });
  } catch (err) {
    console.error('Submit review error:', err);
    res.status(500).json({ message: 'Server error while submitting review' });
  }
};


const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const userId = req.session.user._id;
    const reviewId = req.params.reviewId;

    if (!rating || !comment) {
      return res.status(400).json({ message: 'Rating and comment are required' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this review' });
    }

    review.rating = rating;
    review.comment = comment;
    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review updated successfully.',
      review,
    });
  } catch (err) {
    console.error('Update review error:', err);
    res.status(500).json({ message: 'Server error while updating review' });
  }
};


const deleteReview = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const reviewId = req.params.reviewId;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    await Review.findByIdAndDelete(reviewId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully.',
    });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ message: 'Server error while deleting review' });
  }
};

module.exports = { submitReview, updateReview, deleteReview };
