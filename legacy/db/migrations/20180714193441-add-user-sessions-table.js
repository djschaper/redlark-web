module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('user_sessions', {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            uuid: {
                type: Sequelize.STRING,
                allowNull: false
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW')
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW')
            }
        })
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('user_sessions')
    }
}