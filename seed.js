
require('dotenv').config();

const mongoose = require('mongoose');
const { User, Review } = require('./models');

// Sample user accounts and their movie reviews.
const seedUsers = [
  {
    login: 'john',
    password: 'JohnTest123!',
    reviews: [
      {
        movieTitle: 'Interstellar',
        rating: 5,
        description: 'A beautiful science fiction film with an incredible soundtrack and emotional story.'
      },
      {
        movieTitle: 'Inception',
        rating: 4.5,
        description: 'A fascinating concept with excellent action and an engaging plot.'
      },
      {
        movieTitle: 'The Dark Knight',
        rating: 5,
        description: 'One of the best superhero movies ever made. Heath Ledger delivers an unforgettable performance.'
      }
    ]
  },
  {
    login: 'jane',
    password: 'JaneTest123!',
    reviews: [
      {
        movieTitle: 'La La Land',
        rating: 4.5,
        description: 'Beautiful cinematography and music with a bittersweet ending.'
      },
      {
        movieTitle: 'Whiplash',
        rating: 5,
        description: 'An intense and captivating film with incredible performances.'
      },
      {
        movieTitle: 'Barbie',
        rating: 4,
        description: 'A fun and creative movie with a meaningful message.'
      }
    ]
  },
  {
    login: 'alex',
    password: 'AlexTest123!',
    reviews: [
      {
        movieTitle: 'Parasite',
        rating: 5,
        description: 'An outstanding thriller with brilliant social commentary.'
      },
      {
        movieTitle: 'Everything Everywhere All at Once',
        rating: 4.5,
        description: 'A unique and imaginative film with a surprisingly emotional core.'
      },
      {
        movieTitle: 'Dune: Part Two',
        rating: 4.5,
        description: 'Spectacular visuals, excellent sound design, and an epic story.'
      }
    ]
  }
];

async function seedDatabase() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const seedUser of seedUsers) {
      // Find the user if they already exist.
      let user = await User.findOne({
        login: seedUser.login
      });

      // Create the user only if necessary.
      if (!user) {
        user = await User.create({
          login: seedUser.login,
          password: seedUser.password,
          role: 'user'
        });

        console.log(`Created user: ${user.login}`);
      } else {
        console.log(`User already exists: ${user.login}`);
      }

      // Add reviews only if they do not exist yet.
      for (const reviewData of seedUser.reviews) {
        const existingReview = await Review.findOne({
          userId: user._id,
          movieTitle: reviewData.movieTitle
        });

        if (existingReview) {
          console.log(
            `Skipped existing review: ${user.login} - ${reviewData.movieTitle}`
          );
          continue;
        }

        await Review.create({
          userId: user._id,
          movieTitle: reviewData.movieTitle,
          rating: reviewData.rating,
          description: reviewData.description
        });

        console.log(
          `Created review: ${user.login} - ${reviewData.movieTitle}`
        );
      }
    }

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedDatabase();
