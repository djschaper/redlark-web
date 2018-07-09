const Sequelize = require('sequelize')

const models = require('./models')

let sequelize

const init = () => {
    console.log('Connnecting to db')
    const host = process.env.DB_HOST
    const name = process.env.DB_NAME
    const port = process.env.DB_PORT
    const user = process.env.DB_USER
    const pass = process.env.DB_PASS
    console.log(`Host: ${host}`)
    console.log(`Name: ${name}`)
    console.log(`Port: ${port}`)
    console.log(`User: ${user}`)
    sequelize = new Sequelize(name, user, pass, {
        host,
        port,
        dialect: 'mysql',
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        operatorsAliases: false
    })

    models.setupModels(sequelize)
}

const getInstance = () => sequelize

const getModel = (modelName) => models.db[modelName]

module.exports = {
    init,
    getInstance,
    getModel
}