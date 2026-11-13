
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { User, Review } = require('../models');

let mongoServer;

// Runs once before the entire test suite.
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri());

  // Ensure the unique username index exists.
  await User.init();
});

// Runs after every individual test.
afterEach(async () => {
  await Review.deleteMany({});
  await User.deleteMany({});
});


describe('User Model', () => {

  test('creates a user successfully', async () => {
    const user = await User.create({
      login: 'john',
      password: 'Password123!'
    });

    expect(user._id).toBeDefined();
    expect(user.login).toBe('john');
    expect(user.role).toBe('user');
  });

  test('rejects duplicate usernames', async () => {
    await User.create({
      login: 'john',
      password: 'Password123!'
    });

    await expect(
      User.create({
        login: 'john',
        password: 'AnotherPassword123!'
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  test('requires a username', async () => {
    await expect(
      User.create({
        password: 'Password123!'
      })
    ).rejects.toThrow();
  });

  test('rejects usernames shorter than 3 characters', async () => {
    await expect(
      User.create({
        login: 'ab',
        password: 'Password123!'
      })
    ).rejects.toThrow();
  });

  test('hashes passwords before storing them', async () => {
    const user = await User.create({
      login: 'john',
      password: 'Password123!'
    });

    const storedUser = await User.findById(
      user._id
    ).select('+password');

    expect(storedUser.password).not.toBe('Password123!');

    expect(
      await storedUser.checkPassword('Password123!')
    ).toBe(true);

    expect(
      await storedUser.checkPassword('WrongPassword')
    ).toBe(false);
  });

  test('excludes passwords from normal queries', async () => {
    const user = await User.create({
      login: 'john',
      password: 'Password123!'
    });

    const storedUser = await User.findById(user._id);

    expect(storedUser.password).toBeUndefined();
  });

  test('excludes password hashes from JSON output', async () => {
    const user = await User.create({
      login: 'john',
      password: 'Password123!'
    });

    const json = user.toJSON();

    expect(json.password).toBeUndefined();
  });

});


describe('Review Model', () => {

  // Helper to create a valid test user.
  async function createTestUser(login = 'john') {
    return User.create({
      login,
      password: 'Password123!'
    });
  }

  test('creates a movie review successfully', async () => {
    const user = await createTestUser();

    const review = await Review.create({
      userId: user._id,
      movieTitle: 'Interstellar',
      rating: 5,
      description: 'An incredible science fiction movie.'
    });

    expect(review._id).toBeDefined();
    expect(review.movieTitle).toBe('Interstellar');
    expect(review.rating).toBe(5);
    expect(review.userId.toString()).toBe(user._id.toString());
  });

  test('requires a movie title', async () => {
    const user = await createTestUser();

    await expect(
      Review.create({
        userId: user._id,
        rating: 4,
        description: 'A great movie.'
      })
    ).rejects.toThrow();
  });

  test('requires a review description', async () => {
    const user = await createTestUser();

    await expect(
      Review.create({
        userId: user._id,
        movieTitle: 'Inception',
        rating: 4
      })
    ).rejects.toThrow();
  });

  test('rejects ratings above 5', async () => {
    const user = await createTestUser();

    await expect(
      Review.create({
        userId: user._id,
        movieTitle: 'Interstellar',
        rating: 6,
        description: 'Invalid rating.'
      })
    ).rejects.toThrow();
  });

  test('rejects negative ratings', async () => {
    const user = await createTestUser();

    await expect(
      Review.create({
        userId: user._id,
        movieTitle: 'Interstellar',
        rating: -1,
        description: 'Invalid rating.'
      })
    ).rejects.toThrow();
  });

  test('accepts half-star ratings', async () => {
    const user = await createTestUser();

    const review = await Review.create({
      userId: user._id,
      movieTitle: 'Inception',
      rating: 4.5,
      description: 'Excellent movie.'
    });

    expect(review.rating).toBe(4.5);
  });

  test('rejects ratings outside half-star increments', async () => {
    const user = await createTestUser();

    await expect(
      Review.create({
        userId: user._id,
        movieTitle: 'Inception',
        rating: 4.3,
        description: 'Invalid increment.'
      })
    ).rejects.toThrow();
  });

  test('requires a userId', async () => {
    await expect(
      Review.create({
        movieTitle: 'Interstellar',
        rating: 5,
        description: 'Great movie.'
      })
    ).rejects.toThrow();
  });

  test('retrieves only reviews belonging to a user', async () => {
    const john = await createTestUser('john');
    const jane = await createTestUser('jane');

    await Review.create([
      {
        userId: john._id,
        movieTitle: 'Interstellar',
        rating: 5,
        description: 'Excellent.'
      },
      {
        userId: john._id,
        movieTitle: 'Inception',
        rating: 4.5,
        description: 'Great concept.'
      },
      {
        userId: jane._id,
        movieTitle: 'Barbie',
        rating: 4,
        description: 'Very entertaining.'
      }
    ]);

    const johnReviews = await Review.find({
      userId: john._id
    });

    const janeReviews = await Review.find({
      userId: jane._id
    });

    expect(johnReviews).toHaveLength(2);
    expect(janeReviews).toHaveLength(1);

    expect(
      johnReviews.every(
        review => review.userId.equals(john._id)
      )
    ).toBe(true);

    expect(janeReviews[0].movieTitle).toBe('Barbie');
  });

  test('updates a review successfully', async () => {
    const user = await createTestUser();

    const review = await Review.create({
      userId: user._id,
      movieTitle: 'Interstellar',
      rating: 4,
      description: 'Good movie.'
    });

    review.rating = 5;
    review.description = 'Amazing movie.';

    await review.save();

    const updatedReview = await Review.findById(review._id);

    expect(updatedReview.rating).toBe(5);
    expect(updatedReview.description).toBe('Amazing movie.');
  });

  test('deletes a review successfully', async () => {
    const user = await createTestUser();

    const review = await Review.create({
      userId: user._id,
      movieTitle: 'Interstellar',
      rating: 5,
      description: 'Excellent.'
    });

    await Review.deleteOne({ _id: review._id });

    const deletedReview = await Review.findById(review._id);

    expect(deletedReview).toBeNull();
  });

  test('automatically creates timestamps', async () => {
    const user = await createTestUser();

    const review = await Review.create({
      userId: user._id,
      movieTitle: 'Interstellar',
      rating: 5,
      description: 'Excellent.'
    });

    expect(review.createdAt).toBeInstanceOf(Date);
    expect(review.updatedAt).toBeInstanceOf(Date);
  });

});

// Runs once after the entire test suite.
afterAll(async () => {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
  }
});
