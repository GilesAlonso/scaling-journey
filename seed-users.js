const bcrypt = require('bcryptjs');
const db = require('./database');
require('dotenv').config();

// Test users to seed
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
  },
  {
    username: 'dispatcher1',
    password: 'dispatch123',
    role: 'dispatcher',
    email: 'dispatcher1@example.com',
    firstName: 'Mike',
    lastName: 'Dispatcher'
  },
  {
    username: 'support1',
    password: 'support123',
    role: 'support',
    email: 'support1@example.com',
    firstName: 'Sarah',
    lastName: 'Support'
  }
];

/**
 * Hash password using bcryptjs
 */
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Check if USERS table exists and has records
 */
async function checkUsersTable() {
  try {
    const tableExists = await db.tableExists('USERS');
    
    if (!tableExists) {
      console.log('❌ USERS table does not exist. Creating table...');
      await createUsersTable();
      return { exists: true, hasRecords: false };
    }

    // Check if table has records
    const rows = await db.execute('SELECT COUNT(*) as count FROM USERS');
    const recordCount = Array.isArray(rows) ? rows[0]?.count : 0;
    
    return { exists: true, hasRecords: recordCount > 0, recordCount };
  } catch (error) {
    console.error('❌ Error checking USERS table:', error.message);
    throw error;
  }
}

/**
 * Create USERS table if it doesn't exist
 */
async function createUsersTable() {
  const createTableSQL = `
    CREATE TABLE USERS (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      firstName VARCHAR(50),
      lastName VARCHAR(50),
      isActive BOOLEAN DEFAULT TRUE,
      createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  await db.createTable(createTableSQL);
  console.log('✅ USERS table created successfully');
}

/**
 * Seed users into the database
 */
async function seedUsers(force = false) {
  try {
    const tableStatus = await checkUsersTable();
    
    if (tableStatus.hasRecords && !force) {
      console.log(`📊 USERS table already has ${tableStatus.recordCount} records. Use --force flag to overwrite.`);
      return false;
    }

    // Clear existing users if force is enabled
    if (force) {
      console.log('🗑️  Clearing existing users due to --force flag...');
      await db.execute('DELETE FROM USERS');
    }

    console.log('🔄 Starting user seeding process...');
    let successCount = 0;
    let errorCount = 0;

    await db.beginTransaction();
    
    try {
      for (const user of testUsers) {
        try {
          // Check if user already exists
          const existing = await db.execute(
            'SELECT id FROM USERS WHERE username = $1 OR email = $2',
            [user.username, user.email]
          );

          if (existing.length > 0) {
            if (force) {
              // Update existing user
              const hashedPassword = await hashPassword(user.password);
              await db.execute(
                `UPDATE USERS 
                 SET password_hash = $1, role = $2, firstName = $3, lastName = $4, isActive = TRUE 
                 WHERE username = $5`,
                [hashedPassword, user.role, user.firstName, user.lastName, user.username]
              );
              console.log(`🔄 Updated user: ${user.username} (${user.role})`);
            } else {
              console.log(`⏭️  Skipping existing user: ${user.username}`);
              continue;
            }
          } else {
            // Create new user
            const hashedPassword = await hashPassword(user.password);
            await db.execute(
              `INSERT INTO USERS (username, password_hash, role, email, firstName, lastName, isActive)
               VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
              [user.username, hashedPassword, user.role, user.email, user.firstName, user.lastName]
            );
            console.log(`✅ Created user: ${user.username} (${user.role})`);
          }
          successCount++;
        } catch (userError) {
          console.error(`❌ Error creating user ${user.username}:`, userError.message);
          errorCount++;
        }
      }
      
      await db.commit();
    } catch (error) {
      await db.rollback();
      throw error;
    }

    console.log('\n📈 Seeding Summary:');
    console.log(`✅ Successfully processed: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    
    return successCount > 0 && errorCount === 0;
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error.message);
    throw error;
  }
}

/**
 * Display created users
 */
async function displayUsers() {
  try {
    const users = await db.execute('SELECT username, role, email, firstName, lastName, createdAt FROM USERS ORDER BY role, username');
    
    if (users.length === 0) {
      console.log('📭 No users found in database');
      return;
    }
    
    console.log('\n👥 Created Users:');
    console.log('┌─────────────┬──────────┬─────────────────────┬──────────────┬─────────────┬─────────────────────┐');
    console.log('│ Username    │ Role     │ Email               │ First Name   │ Last Name   │ Created At          │');
    console.log('├─────────────┼──────────┼─────────────────────┼──────────────┼─────────────┼─────────────────────┤');
    
    users.forEach(user => {
      console.log(`│ ${String(user.username || '').padEnd(11)} │ ${String(user.role || '').padEnd(8)} │ ${String(user.email || '').padEnd(19)} │ ${String(user.firstName || '').padEnd(12)} │ ${String(user.lastName || '').padEnd(11)} │ ${String(user.createdAt || '').padEnd(21)} │`);
    });
    console.log('└─────────────┴──────────┴─────────────────────┴──────────────┴─────────────┴─────────────────────┘');
    
    console.log('\n🔐 Test Credentials:');
    testUsers.forEach(user => {
      console.log(`   ${user.username}:${user.password} (${user.role})`);
    });
  } catch (error) {
    console.error('❌ Error displaying users:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting user seeding...');
    console.log('📍 Database Type:', process.env.DB_TYPE || 'postgres');
    
    // Check for force flag
    const args = process.argv.slice(2);
    const force = args.includes('--force');

    // Connect to database
    await db.connect();

    // Check if we should proceed
    const tableStatus = await checkUsersTable();
    
    if (tableStatus.hasRecords && !force) {
      console.log('⚠️  USERS table already contains data. Use --force flag to overwrite existing users.');
      return;
    }

    // Seed the users
    const success = await seedUsers(force);
    
    if (success) {
      console.log('\n🎉 User seeding completed successfully!');
      
      // Display created users
      await displayUsers();
    } else {
      console.log('\n⚠️  User seeding completed with some errors. Check the logs above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await db.close();
    console.log('🔌 Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { seedUsers, checkUsersTable };
