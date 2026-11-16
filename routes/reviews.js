
const express = require('express');
const mongoose = require('mongoose');
const { Review } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Clients may only send these fields. userId always comes from the token.
const EDITABLE_FIELDS = ['movieTitle', 'rating', 'description'];

function pickEditable(body) {
  const picked = {};

  for (const field of EDITABLE_FIELDS) {
    if (body && body[field] !== undefined) {
      picked[field] = body[field];
    }
  }

  return picked;
}

function handleError(error, res, fallback) {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: error.message });
  }

  res.status(500).json({ error: fallback });
}

router.use(requireAuth);

// List the signed-in user's reviews, newest first.
// Out: 200 [review]
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(reviews);
  } catch (error) {
    handleError(error, res, 'Could not load reviews');
  }
});

// Create a review for the signed-in user.
// In:  { movieTitle, rating, description }
// Out: 201 review | 400 invalid input
router.post('/', async (req, res) => {
  try {
    const review = await Review.create({ ...pickEditable(req.body), userId: req.userId });
    res.status(201).json(review);
  } catch (error) {
    handleError(error, res, 'Could not create review');
  }
});

// Fetch one review. A review owned by someone else is reported as not found.
// Out: 200 review | 404
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Review not found' });
  }

  try {
    const review = await Review.findOne({ _id: req.params.id, userId: req.userId });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.status(200).json(review);
  } catch (error) {
    handleError(error, res, 'Could not load review');
  }
});

// Update one of the signed-in user's reviews.
// In:  any of { movieTitle, rating, description }
// Out: 200 review | 400 invalid input | 404
router.patch('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Review not found' });
  }

  const updates = pickEditable(req.body);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.status(200).json(review);
  } catch (error) {
    handleError(error, res, 'Could not update review');
  }
});

// Delete one of the signed-in user's reviews.
// Out: 200 { message } | 404
router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Review not found' });
  }

  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.status(200).json({ message: 'Review deleted' });
  } catch (error) {
    handleError(error, res, 'Could not delete review');
  }
});

module.exports = router;
