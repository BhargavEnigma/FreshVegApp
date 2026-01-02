"use strict";

const { env } = require("./env");

module.exports = {
    development: {
        username: env.db.user,
        password: env.db.password,
        database: env.db.name,
        host: env.db.host,
        port: env.db.port,
        dialect: "postgres",
        logging: false,
        dialectOptions: env.db.ssl
            ? { ssl: { require: true, rejectUnauthorized: false } }
            : {},
    },

    production: {
        username: env.db.user,
        password: env.db.password,
        database: env.db.name,
        host: env.db.host,
        port: env.db.port,
        dialect: "postgres",
        logging: false,
        dialectOptions: env.db.ssl
            ? { ssl: { require: true, rejectUnauthorized: false } }
            : {},
    },
};
