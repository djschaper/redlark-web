module.exports = (sequelize, DataTypes) => {
    const Set = sequelize.define('Set',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            createdBy: {
                field: 'created_by',
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'User',
                    key: 'id'
                }
            },
            updatedAt: {
                field: 'updated_at',
                type: DataTypes.DATE,
                allowNull: false
            }
        },
        {
            underscored: true,
            tableName: 'sets'
        }
    )

    Set.associate = (models) => {
        Set.belongsToMany(models.Song, { through: 'SetSong' })
    }

    return Set
}
