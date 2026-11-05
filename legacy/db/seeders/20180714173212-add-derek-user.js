const defaultUsers = [
    {
        first_name: 'Derek',
        last_name: 'Schaper',
        email: 'derek.j.schaper@gmail.com',
        password_hash: 'sha1$09de8059$1$d61a9366249492d25d3ebe7b4fb2ebff6e3ad6fa'
    }
]

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('users', defaultUsers),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('users', { email: { $in: defaultUsers.map(user => user.email) } })
}