'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GradingLog extends Model {
        static associate(models) {
            // GradingLog belongs to TestAnswer
            GradingLog.belongsTo(models.TestAnswer, {
                foreignKey: 'testAnswerId',
                as: 'Answer'
            });

            // GradingLog belongs to User (grader - HR or null if auto)
            GradingLog.belongsTo(models.User, {
                foreignKey: 'Nguoicham',
                as: 'Grader'
            });
        }
    }

    GradingLog.init({
        Phuongphap: {
            type: DataTypes.ENUM('nlp', 'ai', 'manual', 'hybrid')
        },
        Diemcu: DataTypes.FLOAT,
        Diemmoi: DataTypes.FLOAT,
        Lydocham: DataTypes.TEXT,
        Thoigiancham: DataTypes.FLOAT,
        Nguoicham: DataTypes.INTEGER,
        testAnswerId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'GradingLog',
        tableName: 'GradingLog',
        timestamps: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return GradingLog;
};

