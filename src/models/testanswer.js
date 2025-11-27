'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TestAnswer extends Model {
        static associate(models) {
            // TestAnswer belongs to TestSubmission
            TestAnswer.belongsTo(models.TestSubmission, {
                foreignKey: 'testSubmissionId',
                as: 'Submission'
            });

            // TestAnswer belongs to TestQuestion
            TestAnswer.belongsTo(models.TestQuestion, {
                foreignKey: 'testQuestionId',
                as: 'Question'
            });

            // TestAnswer has many GradingLogs
            TestAnswer.hasMany(models.GradingLog, {
                foreignKey: 'testAnswerId',
                as: 'GradingLogs'
            });
        }
    }

    TestAnswer.init({
        Cautraloi: DataTypes.TEXT,
        Diemdatduoc: {
            type: DataTypes.FLOAT,
            defaultValue: 0
        },
        Nhanxet: DataTypes.TEXT,
        Dungkhong: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        Phuongphap: {
            type: DataTypes.ENUM('nlp', 'ai', 'manual', 'hybrid'),
            defaultValue: 'hybrid'
        },
        Dosattinhcua_nlp: DataTypes.FLOAT,
        Dosattinhcua_ai: DataTypes.FLOAT,
        testSubmissionId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        testQuestionId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'TestAnswer',
        tableName: 'TestAnswer',
        timestamps: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return TestAnswer;
};

