import { Sequelize } from 'sequelize';
import dotenv from 'dotenv'

dotenv.config()

interface DBConfig {
  database: string;
  username: string;
  password: string;
  host: string;
  port: number;
  dialect: 'postgres'
}

const dbConfig: DBConfig = {
  database: process.env.DB_NAME || 'the_bank',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  dialect: 'postgres'
};

export const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the PostgreSQL:', error);
    process.exit(1)
  }
};