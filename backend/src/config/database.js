import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Table prefix for Moodle tables (e.g., 'mdl_', 'moodle_', or empty string)
export const DB_PREFIX = process.env.DB_PREFIX || '';

// Create connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'moodle',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Execute read-only query with error handling
export async function executeQuery(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return { success: true, data: rows };
  } catch (error) {
    console.error('Query error:', error.message);
    return { success: false, error: error.message };
  }
}

// Validate SQL is read-only (SELECT only)
export function isReadOnlyQuery(sql) {
  const trimmedSql = sql.trim().toUpperCase();
  const forbiddenKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'REPLACE', 'GRANT', 'REVOKE'];

  // Must start with SELECT or WITH (for CTEs)
  if (!trimmedSql.startsWith('SELECT') && !trimmedSql.startsWith('WITH')) {
    return false;
  }

  // Check for forbidden keywords
  for (const keyword of forbiddenKeywords) {
    if (trimmedSql.includes(keyword)) {
      return false;
    }
  }

  return true;
}

export default pool;
