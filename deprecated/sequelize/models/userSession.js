module.exports = (sequelize, DataTypes) => {
    const UserSession = sequelize.define('UserSession',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            uuid: {
                type: DataTypes.UUID,
                allowNull: false
            },
            userId: {
                field: 'user_id',
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'User',
                    key: 'id'
                }
            }
        },
        {
            tableName: 'user_sessions',
            underscored: true
        }
    )

    UserSession.associate = (models) => {
        // associations can be defined here
    }

    return UserSession
}
