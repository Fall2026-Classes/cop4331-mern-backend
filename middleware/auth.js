
const jwt = require('jsonwebtoken');

const TOKEN_LIFETIME = '7d';
let warnedAboutDevSecret = false;

// The signing secret comes from JWT_SECRET. A fixed fallback is allowed
// outside production so local development works without extra setup.
function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not configured');
  }

  if (!warnedAboutDevSecret) {
    console.warn('JWT_SECRET is not set; using an insecure development secret.');
    warnedAboutDevSecret = true;
  }

  return 'dev-only-secret';
}

// Create a signed token that identifies a user.
function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, getSecret(), {
    expiresIn: TOKEN_LIFETIME
  });
}

// Require "Authorization: Bearer <token>" and set req.userId.
// Out: 401 { error } when the token is missing, invalid, or expired.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, getSecret());
    req.userId = payload.sub;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, requireAuth };
