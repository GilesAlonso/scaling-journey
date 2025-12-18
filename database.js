const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

/**
 * Database configuration and connection helper
 * Supports both MySQL (production) and SQLite (testing)
 */
class Database {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'sqlite'; // 'mysql' or 'sqlite'
    this.connection = null;
    this.pool = null;
  }

  /**
   * Initialize database connection
   */
  async connect() {
    try {
      if (this.dbType === 'mysql') {
        await this.connectMySQL();
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
   * Connect to MySQL (NocoDB)
   */
  async connectMySQL() {
    const dbConfig = {
      host: process.env.NOCODB_HOST || 'localhost',
      port: process.env.NOCODB_PORT || 8080,
      user: process.env.NOCODB_USERNAME || 'root',
      password: process.env.NOCODB_PASSWORD || 'password',
      database: process.env.NOCODB_DATABASE || 'scaling_journey',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

    this.pool = mysql.createPool(dbConfig);
    
    // Test connection
    await this.pool.query('SELECT 1');
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
    if (this.dbType === 'mysql') {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
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
    if (this.dbType === 'mysql') {
      const [rows] = await this.execute(`SHOW TABLES LIKE ?`, [tableName]);
      return rows.length > 0;
    } else {
      const rows = await this.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, 
        [tableName]
      );
      return rows.length > 0;
    }
  }

  /**
   * Create table (MySQL compatible syntax)
   */
  async createTable(sql) {
    if (this.dbType === 'sqlite') {
      // Convert MySQL syntax to SQLite
      sql = this.convertMySQLToSQLite(sql);
    }
    
    await this.execute(sql);
  }

  /**
   * Convert MySQL syntax to SQLite
   */
  convertMySQLToSQLite(mysqlSql) {
    let sqliteSql = mysqlSql;
    
    // Remove MySQL-specific syntax
    sqliteSql = sqliteSql.replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT');
    sqliteSql = sqliteSql.replace(/ON UPDATE CURRENT_TIMESTAMP/gi, '');
    sqliteSql = sqliteSql.replace(/DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/gi, '');
    sqliteSql = sqliteSql.replace(/ENGINE=InnoDB/gi, '');
    
    // Handle TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    sqliteSql = sqliteSql.replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    
    return sqliteSql;
  }

  /**
   * Begin transaction
   */
  async beginTransaction() {
    if (this.dbType === 'mysql') {
      await this.execute('START TRANSACTION');
    } else {
      await this.execute('BEGIN TRANSACTION');
    }
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
    if (this.dbType === 'mysql' && this.pool) {
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
