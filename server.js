const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Middleware
app.use(express.json());

/**
 * Auto-seed function - runs on startup
 */
async function autoSeedOnStartup() {
  try {
    console.log('🔍 Checking USERS table for existing data...');
    
    // Check if USERS table exists and has records
    const tableExists = await db.tableExists('USERS');
    
    if (!tableExists) {
      console.log('📝 USERS table does not exist. Creating table and seeding initial users...');
      await createUsersTable();
      await seedInitialUsers();
      console.log('✅ Auto-seeding completed successfully');
    } else {
      // Check record count
      const rows = await db.execute('SELECT COUNT(*) as count FROM USERS');
      const recordCount = Array.isArray(rows) ? rows[0]?.count : 0;
      
      if (recordCount === 0) {
        console.log('📝 USERS table is empty. Seeding initial users...');
        await seedInitialUsers();
        console.log('✅ Auto-seeding completed successfully');
      } else {
        console.log(`📊 USERS table contains ${recordCount} existing users. Skipping auto-seeding.`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during auto-seeding:', error.message);
    // Continue startup even if seeding fails
  }
}

/**
 * Create USERS table (reused from seed script)
 */
async function createUsersTable() {
  const createTableSQL = `
    CREATE TABLE USERS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      firstName VARCHAR(50),
      lastName VARCHAR(50),
      isActive BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  await db.createTable(createTableSQL);
  console.log('✅ USERS table created successfully');
}

/**
 * Seed initial users (reused from seed script logic)
 */
async function seedInitialUsers() {
  const testUsers = [
    {
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User'
    },
    {
      username: 'driver1',
      password: 'driver123',
      role: 'driver',
      email: 'driver1@example.com',
      firstName: 'John',
      lastName: 'Driver'
    },
    {
      username: 'customer1',
      password: 'customer123',
      role: 'customer',
      email: 'customer1@example.com',
      firstName: 'Jane',
      lastName: 'Customer'
    }
  ];

  console.log('🌱 Seeding initial users...');
  
  await db.beginTransaction();
  try {
    for (const user of testUsers) {
      try {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        // Use INSERT OR REPLACE for SQLite compatibility
        await db.execute(
          `INSERT OR REPLACE INTO USERS (id, username, password_hash, role, email, firstName, lastName, isActive)
           VALUES (
             COALESCE((SELECT id FROM USERS WHERE username = ?), NULL),
             ?, ?, ?, ?, ?, ?, 1
           )`,
          [user.username, user.username, hashedPassword, user.role, user.email, user.firstName, user.lastName]
        );
        console.log(`✅ Seeded user: ${user.username} (${user.role})`);
      } catch (userError) {
        console.error(`❌ Error seeding user ${user.username}:`, userError.message);
      }
    }
    
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  }
  
  console.log('🌱 Initial user seeding completed');
}

/**
 * Generate JWT token
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
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token middleware
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
 * Role-based authorization middleware
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

// Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: process.env.DB_TYPE || 'sqlite'
  });
});

// Get all users (admin only)
app.get('/api/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await db.execute(
      'SELECT id, username, role, email, firstName, lastName, isActive, createdAt, updatedAt FROM USERS ORDER BY username'
    );
    
    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        ...user,
        password_hash: undefined // Don't return password hashes
      }))
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get current user info
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const users = await db.execute(
      'SELECT id, username, role, email, firstName, lastName, isActive, createdAt, updatedAt FROM USERS WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        ...users[0],
        password_hash: undefined
      }
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    // Find user in database
    const users = await db.execute(
      'SELECT id, username, password_hash, role, email, firstName, lastName, isActive FROM USERS WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });

    console.log(`🔐 User logged in: ${user.username} (${user.role})`);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoint to check JWT functionality
app.get('/api/admin/test-jwt', authenticateToken, requireRole('admin'), (req, res) => {
  res.json({
    success: true,
    message: 'JWT authentication successful!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Driver endpoint to test role-based access
app.get('/api/driver/test-jwt', authenticateToken, requireRole('driver', 'admin'), (req, res) => {
  res.json({
    success: true,
    message: 'Driver JWT authentication successful!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server with auto-seeding
async function startServer() {
  try {
    console.log('🚀 Starting server...');
    
    // Connect to database
    await db.connect();
    console.log('✅ Database connection successful');
    
    // Run auto-seeding
    await autoSeedOnStartup();
    
    // Start the HTTP server
    app.listen(PORT, () => {
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📋 Available endpoints:`);
      console.log(`   POST /api/auth/login`);
      console.log(`   GET  /health`);
      console.log(`   GET  /api/me (requires auth)`);
      console.log(`   GET  /api/users (admin only)`);
      console.log(`   GET  /api/admin/test-jwt (admin only)`);
      console.log(`   GET  /api/driver/test-jwt (driver/admin)`);
      console.log('\n🔐 Test with:');
      console.log('   curl -X POST http://localhost:3000/api/auth/login \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log('     -d \'{"username":"admin","password":"admin123"}\'');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
