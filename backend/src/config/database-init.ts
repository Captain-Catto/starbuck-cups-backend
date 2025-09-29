import sequelize from './database';
import { hashPassword } from '../utils/password';

/**
 * Initialize database connection and create tables
 */
export const initializeDatabase = async (): Promise<boolean> => {
  try {
    console.log('🔄 Initializing database connection...');

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Sync models (create tables)
    console.log('🔄 Syncing database models...');
    await sequelize.sync({ alter: false });
    console.log('✅ Database models synced successfully.');

    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};


/**
 * Initialize session store
 */
export const initializeSessionStore = async (): Promise<void> => {
  try {
    console.log('🔄 Initializing session store...');
    // Session table will be automatically created by connect-session-sequelize
    console.log('✅ Session store initialized.');
  } catch (error) {
    console.error('⚠️  Session store initialization warning:', error);
    // Don't throw error as this is not critical
  }
};

/**
 * Clean up database connections on shutdown
 */
export const cleanupDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    console.log('✅ Database connections closed.');
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  }
};