const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);
const db = {};

const setupModels = (sequelize) => {
    fs.readdirSync(__dirname)
        .filter(file => {
            return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js')
        })
        .forEach(file => {
            var model = sequelize.import(path.join(__dirname, file))
            db[model.name] = model
        })

    Object.keys(db).forEach(modelName => {
        if (db[modelName].associate) {
            db[modelName].associate(db)
        }
    })
}

module.exports = {
    setupModels,
    db
}