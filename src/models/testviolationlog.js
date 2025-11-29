'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TestViolationLog extends Model {
        static associate(models) {
            // Belongs to TestSubmission
            TestViolationLog.belongsTo(models.TestSubmission, {
                foreignKey: 'testSubmissionId',
                as: 'TestSubmission'
            });

            // Belongs to User
            TestViolationLog.belongsTo(models.User, {
                foreignKey: 'userId',
                as: 'User'
            });
        }
    }

    TestViolationLog.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        testSubmissionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'testsubmission',
                key: 'id'
            }
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },
        violation_type: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'TestViolationLog',
        tableName: 'testviolationlog',
        timestamps: true
    });

    return TestViolationLog;
};

