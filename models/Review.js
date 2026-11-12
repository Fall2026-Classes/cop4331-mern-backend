
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },

    movieTitle: {
      type: String,
      required: [true, 'Movie title is required'],
      trim: true,
      maxlength: [200, 'Movie title is too long']
    },

    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [0, 'Rating must be at least 0'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: (value) => Number.isInteger(value * 2),
        message: 'Rating must be in half-star increments'
      }
    },

    description: {
      type: String,
      required: [true, 'Review description is required'],
      trim: true,
      maxlength: [5000, 'Review is too long']
    }
  },
  {
    collection: 'reviews',
    timestamps: true,
    versionKey: false
  }
);

// Optimize retrieval of a user's reviews,
// ordered newest first.
reviewSchema.index({
  userId: 1,
  createdAt: -1
});

module.exports = mongoose.model('Review', reviewSchema);
