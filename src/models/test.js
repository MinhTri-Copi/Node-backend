'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Test extends Model {
        static associate(models) {
            // Test belongs to JobPosting
            Test.belongsTo(models.JobPosting, {
                foreignKey: 'jobPostingId',
                as: 'JobPosting'
            });

            // Test has many TestQuestions
            Test.hasMany(models.TestQuestion, {
                foreignKey: 'testId',
                as: 'Questions'
            });

            // Test has many TestSubmissions
            Test.hasMany(models.TestSubmission, {
                foreignKey: 'testId',
                as: 'Submissions'
            });
        }
    }

    Test.init({
        Tieude: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        Mota: DataTypes.TEXT,
        Thoigiantoida: {
            type: DataTypes.INTEGER,
            defaultValue: 60
        },
        Ngaybatdau: DataTypes.DATE,
        Ngayhethan: DataTypes.DATE,
        Tongdiem: {
            type: DataTypes.INTEGER,
            defaultValue: 100
        },
        Trangthai: {
            type: DataTypes.TINYINT,
            defaultValue: 1
        },
        jobPostingId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'Test',
        tableName: 'Test',
        timestamps: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return Test;
};

