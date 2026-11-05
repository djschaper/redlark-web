const MAJOR_MUSICAL_CHORDS = [
    'Ab',
    'A',
    'A#',
    'Bb',
    'B',
    'C',
    'C#',
    'Db',
    'D',
    'D#',
    'Eb',
    'E',
    'F',
    'F#',
    'Gb',
    'G',
    'G#',
]
const MINOR_MUSICAL_CHORDS = MAJOR_MUSICAL_CHORDS.map(key => key + 'm')
const MUSICAL_CHORDS = [...MAJOR_MUSICAL_CHORDS, ...MINOR_MUSICAL_CHORDS]

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.createTable('songs', {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            cloud_id: {
                type: Sequelize.STRING,
                allowNull: false
            },
            title: {
                type: Sequelize.STRING,
                allowNull: false
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
        .then(() => queryInterface.createTable('sets', {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            created_by: {
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
        }))
        .then(() => queryInterface.createTable('sets_songs', {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            set_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'sets',
                    key: 'id'
                }
            },
            song_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'songs',
                    key: 'id'
                }
            },
            order: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            key: {
                type: Sequelize.ENUM(MUSICAL_CHORDS),
                allowNull: false
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
        })),

    down: (queryInterface) => queryInterface.dropTable('sets_songs')
        .then(() => queryInterface.dropTable('sets'))
        .then(() => queryInterface.dropTable('songs'))
}