
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { User } = require('./models');

require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/ping', (req, res) => {
  res.status(200).json({
    message: 'Hello World'
  });
});

// Register a new user.
// In:  { login, password }
// Out: 201 { message, user } | 400 invalid input | 409 login taken
// DB:  User.create() -> insertOne into users (password hashed by the model)
app.post('/api/users', async (req, res) => {
  const { login, password } = req.body || {};

  if (typeof login !== 'string' || typeof password !== 'string' || !password) {
    return res.status(400).json({
      error: 'login and password are required'
    });
  }

  try {
    // Only login and password are accepted, so clients cannot set role.
    const user = await User.create({ login, password });

    res.status(201).json({
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Login already exists' });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

// Log in an existing user.
// In:  { login, password }
// Out: 200 user record | 401 { error }
// DB:  User.findOne({ login }) with the password hash selected, then checkPassword()
app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body || {};

  if (typeof login !== 'string' || typeof password !== 'string') {
    return res.status(401).json({ error: 'Invalid login or password' });
  }

  try {
    const user = await User.findOne({ login }).select('+password');

    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: 'Invalid login or password' });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured');
    }

    await mongoose.connect(MONGODB_URI);

    console.log(
      'MongoDB connected successfully via Mongoose'
    );

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
