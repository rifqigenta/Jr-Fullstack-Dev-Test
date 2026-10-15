import mariadb, { type PoolConnection } from "mariadb";
import { env } from "./env.js";

// MariaDB connection pool
export const pool = mariadb.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,

  connectionLimit: 5,
  acquireTimeout: 10000,
  connectTimeout: 10000,
  bigIntAsNumber: false,
});

// Check MariaDB connection
export async function checkDatabaseConnection(): Promise<boolean> {
  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();

    await connection.query("SELECT 1 AS connected");

    return true;
  } catch (error) {
    console.error("Database connection failed:", error);

    return false;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
