'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TestSubmission extends Model {
        static associate(models) {
            // TestSubmission belongs to Test
            TestSubmission.belongsTo(models.Test, {
                foreignKey: 'testId',
                as: 'Test'
            });

            // TestSubmission belongs to User (candidate)
            TestSubmission.belongsTo(models.User, {
                foreignKey: 'userId',
                as: 'User'
            });

            // TestSubmission belongs to JobApplication (optional)
            TestSubmission.belongsTo(models.JobApplication, {
                foreignKey: 'jobApplicationId',
                as: 'JobApplication'
            });

            // TestSubmission has many TestAnswers
            TestSubmission.hasMany(models.TestAnswer, {
                foreignKey: 'testSubmissionId',
                as: 'Answers'
            });
        }
    }

    TestSubmission.init({
        Thoigianbatdau: DataTypes.DATE,
        Thoigianketthuc: DataTypes.DATE,
        Thoigianconlai: DataTypes.INTEGER,
        Hanhethan: DataTypes.DATE,
        Tongdiemdatduoc: {
            type: DataTypes.FLOAT,
            defaultValue: 0
        },
        Trangthai: {
            type: DataTypes.ENUM('chuabatdau', 'danglam', 'danop', 'dacham', 'hethan', 'huy'),
            defaultValue: 'chuabatdau'
        },
        Ghichu: DataTypes.TEXT,
        testId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        jobApplicationId: DataTypes.INTEGER
    }, {
        sequelize,
        modelName: 'TestSubmission',
        tableName: 'TestSubmission',
        timestamps: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return TestSubmission;
};

