'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TestQuestion extends Model {
        static associate(models) {
            // TestQuestion belongs to Test
            TestQuestion.belongsTo(models.Test, {
                foreignKey: 'testId',
                as: 'Test'
            });

            // TestQuestion has many TestAnswers
            TestQuestion.hasMany(models.TestAnswer, {
                foreignKey: 'testQuestionId',
                as: 'Answers'
            });
        }
    }

    TestQuestion.init({
        Cauhoi: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        Dapan: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        Loaicauhoi: {
            type: DataTypes.ENUM('tuluan', 'tracnghiem'),
            defaultValue: 'tuluan'
        },
        Options: {
            type: DataTypes.JSON,
            defaultValue: null,
            comment: 'Các lựa chọn cho câu trắc nghiệm (A, B, C, D) - Format: {A: "text", B: "text", C: "text", D: "text"}'
        },
        Diem: {
            type: DataTypes.INTEGER,
            defaultValue: 10
        },
        Thutu: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        },
        testId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'TestQuestion',
        tableName: 'TestQuestion',
        timestamps: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return TestQuestion;
};

