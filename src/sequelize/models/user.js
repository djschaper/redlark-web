module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('user', {
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
        }
    }, { underscored: true })

    return User
}
