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
    console.log('🔄 Initializing database connection...');

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    if (shouldSyncDatabaseOnStart()) {
      console.log('🔄 Syncing database models...');
      await sequelize.sync({ alter: false });
      console.log('✅ Database models synced successfully.');
    } else {
      console.log('ℹ️ Skipping model sync (DB_SYNC_ON_START=false)');
    }

    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};


/**
 * Initialize session store
 */
export const initializeSessionStore = async (sessionStore?: any): Promise<void> => {
  try {
    console.log('🔄 Initializing session store...');

    const shouldSyncSessionStore =
      process.env.SESSION_STORE_SYNC_ON_START === "true" ||
      (process.env.SESSION_STORE_SYNC_ON_START !== "false" &&
        process.env.NODE_ENV !== "production");

    if (shouldSyncSessionStore && sessionStore?.sync) {
      await sessionStore.sync();
      console.log("✅ Session store table synced.");
    }

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
