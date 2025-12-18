const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Middleware to authenticate JWT tokens
 * Extracts token from Authorization header: "Bearer TOKEN"
 * Verifies token and attaches decoded user info to req.user
 * Returns 401 if no token provided
 * Returns 403 if token verification fails
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

/**
 * Middleware for role-based authorization
 * Usage: requireRole('admin', 'driver')
 * Allows multiple roles to access the endpoint
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: req.user?.role 
      });
    }
    next();
  };
}

/**
 * Generate JWT token for a user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

module.exports = {
  authenticateToken,
  requireRole,
  generateToken,
  JWT_SECRET,
  JWT_EXPIRY
};
