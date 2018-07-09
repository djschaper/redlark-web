require('dotenv').config({ path: '../.env' })

const prompt = require('prompt-promise')

const sequelize = require('../src/sequelize')

const syncOptions = { force: true }

sequelize.init()
console.log(`About to sync database with following options: ${JSON.stringify(syncOptions)}`)
return prompt('Proceed? (y/n): ')
    .then((proceed) => {
        if (proceed.toLowerCase() !== 'y') {
            console.log('Aborting sync. Exiting.')
            process.exit(0)
        }

        return sequelize.getInstance().sync(syncOptions)
            .then(() => sequelize.getModel('user').upsert({
                firstName: 'Derek',
                lastName: 'Schaper',
                email: 'derek.j.schaper@gmail.com',
                passwordHash: 'sha1$09de8059$1$d61a9366249492d25d3ebe7b4fb2ebff6e3ad6fa'
            }))
            .then(() => {
                console.log('\nSuccessfully synced database!')
                process.exit(0)
            })
    })
