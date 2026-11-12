
const mongoose = require('mongoose');
const { User, Review } = require('../models');

async function testModels() {
  let testUser;

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected to MongoDB');

    // Create a test user with a unique username.
    testUser = await User.create({
      login: `testuser_${Date.now()}`,
      password: 'testPassword123!'
    });

    console.log('Created user:', testUser.login);

    // Create two reviews associated with the user.
    await Review.create([
      {
        userId: testUser._id,
        movieTitle: 'Interstellar',
        rating: 5,
        description: 'An incredible science fiction movie.'
      },
      {
        userId: testUser._id,
        movieTitle: 'The Batman',
        rating: 4.5,
        description: 'Great cinematography and atmosphere.'
      }
    ]);

    console.log('Created two reviews');

    // Retrieve all reviews belonging to this user.
    const reviews = await Review.find({
      userId: testUser._id
    });

    console.log('User reviews:');
    console.log(reviews);

    if (reviews.length !== 2) {
      throw new Error('Expected exactly 2 reviews');
    }

    // Check that rating validation works.
    const invalidReview = new Review({
      userId: testUser._id,
      movieTitle: 'Invalid Movie',
      rating: 6,
      description: 'This should fail.'
    });

    const error = invalidReview.validateSync();

    if (!error?.errors?.rating) {
      throw new Error('Invalid rating was accepted');
    }

    console.log('Invalid rating correctly rejected');

    // Verify passwords are hashed.
    const storedUser = await User.findById(
      testUser._id
    ).select('+password');

    if (storedUser.password === 'testPassword123!') {
      throw new Error('Password was stored as plaintext');
    }

    const passwordCorrect = await storedUser.checkPassword(
      'testPassword123!'
    );

    if (!passwordCorrect) {
      throw new Error('Password verification failed');
    }

    console.log('Password hashing verified');
    console.log('All model checks passed!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exitCode = 1;
  } finally {
    // Remove temporary test data.
    if (testUser) {
      await Review.deleteMany({ userId: testUser._id });
      await User.deleteOne({ _id: testUser._id });
    }

    await mongoose.disconnect();
  }
}

testModels();
