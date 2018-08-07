const { MUSICAL_CHORDS } = require('../../lib/chords')

module.exports = (sequelize, DataTypes) => {
    const SetSong = sequelize.define('SetSong',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            setId: {
                field: 'set_id',
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'sets',
                    key: 'id'
                }
            },
            songId: {
                field: 'song_id',
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'songs',
                    key: 'id'
                }
            },
            order: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            key: {
                type: DataTypes.ENUM(MUSICAL_CHORDS),
                allowNull: false
            }
        },
        {
            underscored: true,
            tableName: 'sets_songs'
        }
    )

    return SetSong
}
