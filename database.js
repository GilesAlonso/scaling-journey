const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

/**
 * Database configuration and connection helper
 * Supports both PostgreSQL (NocoDB) and SQLite (testing)
 */
class Database {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'postgres'; // 'postgres' or 'sqlite'
    this.connection = null;
    this.pool = null;
  }

  /**
   * Initialize database connection
   */
  async connect() {
    try {
      if (this.dbType === 'postgres') {
        await this.connectPostgreSQL();
      } else {
        await this.connectSQLite();
      }
      console.log(`✅ Connected to ${this.dbType.toUpperCase()} database`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${this.dbType} database:`, error.message);
      throw error;
    }
  }

  /**
   * Connect to PostgreSQL (NocoDB)
   */
  async connectPostgreSQL() {
    const dbConfig = {
      host: process.env.NOCODB_HOST || 'localhost',
      port: process.env.NOCODB_PORT || 5432,
      user: process.env.NOCODB_USERNAME || 'postgres',
      password: process.env.NOCODB_PASSWORD || 'password',
      database: process.env.NOCODB_DATABASE || 'nocodb',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.pool = new Pool(dbConfig);
    
    // Test connection
    const client = await this.pool.connect();
    await client.query('SELECT NOW()');
    client.release();
  }

  /**
   * Connect to SQLite (for testing)
   */
  async connectSQLite() {
    return new Promise((resolve, reject) => {
      const dbPath = process.env.SQLITE_PATH || './test.db';
      
      this.connection = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Execute query
   */
  async execute(sql, params = []) {
    if (this.dbType === 'postgres') {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } else {
      return this.executeSQLite(sql, params);
    }
  }

  /**
   * Execute SQLite query
   */
  async executeSQLite(sql, params = []) {
    return new Promise((resolve, reject) => {
      // Handle different SQL statement types
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        this.connection.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      } else {
        this.connection.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve([{ insertId: this.lastID, affectedRows: this.changes }]);
          }
        });
      }
    });
  }

  /**
   * Check if table exists
   */
  async tableExists(tableName) {
    if (this.dbType === 'postgres') {
      const result = await this.execute(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`, 
        [tableName]
      );
      return result[0].exists;
    } else {
      const rows = await this.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, 
        [tableName]
      );
      return rows.length > 0;
    }
  }

  /**
   * Create table (PostgreSQL compatible syntax)
   */
  async createTable(sql) {
    if (this.dbType === 'sqlite') {
      // Convert PostgreSQL syntax to SQLite
      sql = this.convertPostgreSQLToSQLite(sql);
    }
    
    await this.execute(sql);
  }

  /**
   * Convert PostgreSQL syntax to SQLite
   */
  convertPostgreSQLToSQLite(postgresSql) {
    let sqliteSql = postgresSql;
    
    // Handle SERIAL PRIMARY KEY
    sqliteSql = sqliteSql.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY');
    
    // Handle TIMESTAMP WITH TIME ZONE
    sqliteSql = sqliteSql.replace(/TIMESTAMP WITH TIME ZONE/gi, 'DATETIME');
    sqliteSql = sqliteSql.replace(/TIMESTAMP WITHOUT TIME ZONE/gi, 'DATETIME');
    
    // Handle TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    sqliteSql = sqliteSql.replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    
    // Remove ON UPDATE CURRENT_TIMESTAMP
    sqliteSql = sqliteSql.replace(/ON UPDATE CURRENT_TIMESTAMP/gi, '');
    
    // Handle BOOLEAN DEFAULT TRUE/FALSE
    sqliteSql = sqliteSql.replace(/BOOLEAN DEFAULT TRUE/gi, 'BOOLEAN DEFAULT 1');
    sqliteSql = sqliteSql.replace(/BOOLEAN DEFAULT FALSE/gi, 'BOOLEAN DEFAULT 0');
    
    return sqliteSql;
  }

  /**
   * Begin transaction
   */
  async beginTransaction() {
    await this.execute('BEGIN');
  }

  /**
   * Commit transaction
   */
  async commit() {
    await this.execute('COMMIT');
  }

  /**
   * Rollback transaction
   */
  async rollback() {
    await this.execute('ROLLBACK');
  }

  /**
   * Close connection
   */
  async close() {
    if (this.dbType === 'postgres' && this.pool) {
      await this.pool.end();
    } else if (this.dbType === 'sqlite' && this.connection) {
      return new Promise((resolve) => {
        this.connection.close((err) => {
          if (err) {
            console.error('Error closing SQLite connection:', err);
          }
          resolve();
        });
      });
    }
  }
}

// Create singleton instance
const db = new Database();

module.exports = db;
