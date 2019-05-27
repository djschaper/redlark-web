module.exports = (sequelize, DataTypes) => {
    const Song = sequelize.define('Song',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            cloudId: {
                field: 'cloud_id',
                type: DataTypes.STRING,
                allowNull: false
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false
            }
        },
        {
            underscored: true,
            tableName: 'songs'
        }
    )

    Song.associate = (models) => {
        Song.belongsToMany(models.Set, { through: 'SetSong' })
    }

    return Song
}
