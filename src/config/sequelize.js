require('dotenv').config();

const common = {
  define: {
    underscored: true,
    timestamps: true,
    paranoid: false,
  },
  logging: false,
};

const development = {
  dialect: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  username: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'navara',
  ...common,
};

const test = {
  dialect: 'sqlite',
  storage: ':memory:',
  ...common,
};

const production = {
  ...development,
  ...common,
};

module.exports = { development, test, production };
