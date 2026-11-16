
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    login: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters']
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },

    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },

    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    }
  },
  {
    collection: 'users',
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      }
    }
  }
);

// Hash passwords before saving to MongoDB.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(
    this.password,
    SALT_ROUNDS
  );
});

// Verify a password during login.
userSchema.methods.checkPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
