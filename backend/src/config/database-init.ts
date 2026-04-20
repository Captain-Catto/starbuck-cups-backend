import { logger } from "@/utils/logger";
import sequelize from './database';

const shouldSyncDatabaseOnStart = (): boolean => {
  if (process.env.DB_SYNC_ON_START === "true") {
    return true;
  }

  if (process.env.DB_SYNC_ON_START === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
};

/**
 * Initialize database connection and create tables
 */
export const initializeDatabase = async (): Promise<boolean> => {
  try {
    logger.info('🔄 Initializing database connection...');

    // Test connection
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully.');

    if (shouldSyncDatabaseOnStart()) {
      logger.info('🔄 Syncing database models...');
      await sequelize.sync({ alter: false });
      logger.info('✅ Database models synced successfully.');
    } else {
      logger.info('ℹ️ Skipping model sync (DB_SYNC_ON_START=false)');
    }

    return true;
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
};


/**
 * Initialize session store
 */
export const initializeSessionStore = async (sessionStore?: any): Promise<void> => {
  try {
    logger.info('🔄 Initializing session store...');

    const shouldSyncSessionStore =
      process.env.SESSION_STORE_SYNC_ON_START === "true" ||
      (process.env.SESSION_STORE_SYNC_ON_START !== "false" &&
        process.env.NODE_ENV !== "production");

    if (shouldSyncSessionStore && sessionStore?.sync) {
      await sessionStore.sync();
      logger.info("✅ Session store table synced.");
    }

    logger.info('✅ Session store initialized.');
  } catch (error) {
    logger.error('⚠️  Session store initialization warning:', error);
    // Don't throw error as this is not critical
  }
};

/**
 * Clean up database connections on shutdown
 */
export const cleanupDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    logger.info('✅ Database connections closed.');
  } catch (error) {
    logger.error('❌ Error during database cleanup:', error);
  }
};
