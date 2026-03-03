require('dotenv').config();

const shouldUseSSL =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  (process.env.DATABASE_URL || '').includes('sslmode=require') ||
  (process.env.DATABASE_URL_TEST || '').includes('sslmode=require');

const commonConfig = {
  dialect: 'postgres',
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
  },
  ...(shouldUseSSL
    ? {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      }
    : {}),
};

module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    ...commonConfig,
    logging: console.log,
  },
  test: {
    use_env_variable: 'DATABASE_URL_TEST',
    ...commonConfig,
    logging: false,
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    ...commonConfig,
    logging: false,
  },
};
