module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        firstName: {
            field: 'first_name',
            type: DataTypes.STRING,
            allowNull: false
        },
        lastName: {
            field: 'last_name',
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        passwordHash: {
            field: 'password_hash',
            type: DataTypes.STRING,
            allowNull: false
        },
        phoneNumber: {
            field: 'phone_number',
            type: DataTypes.STRING
        }
    })

    User.associate = (models) => {
        User.hasMany(models.UserSession)
    }

    return User
}
