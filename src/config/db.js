const { Sequelize } = require("sequelize");
const { env } = require("./env");

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
    host: env.db.host,
    port: env.db.port,
    dialect: "postgres",
    logging: false,
    dialectOptions: env.db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {}
});

async function testDbConnection() {
    await sequelize.authenticate();
}

module.exports = { sequelize, testDbConnection };
