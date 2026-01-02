"use strict";

const fs = require("fs");
const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");

const basename = path.basename(__filename);

// You will already have sequelize instance in your project.
// Here we keep it minimal and expect you to pass it in or create it outside.
// If you prefer: export a function initModels(sequelize).
function initModels(sequelize) {
    const db = {};

    fs.readdirSync(__dirname)
        .filter((file) => {
            return (
                file.indexOf(".") !== 0 &&
                file !== basename &&
                file.slice(-3) === ".js"
            );
        })
        .forEach((file) => {
            const modelFactory = require(path.join(__dirname, file));
            const model = modelFactory(sequelize, DataTypes);
            db[model.name] = model;
        });

    // Run associations
    Object.keys(db).forEach((modelName) => {
        if (db[modelName].associate) {
            db[modelName].associate(db);
        }
    });

    db.sequelize = sequelize;
    db.Sequelize = Sequelize;

    return db;
}

module.exports = initModels;
