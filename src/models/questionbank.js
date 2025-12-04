'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class QuestionBank extends Model {
        static associate(models) {
            // QuestionBank belongs to User (HR)
            QuestionBank.belongsTo(models.User, {
                foreignKey: 'userId',
                as: 'User'
            });

            // QuestionBank has many QuestionBankItems
            QuestionBank.hasMany(models.QuestionBankItem, {
                foreignKey: 'questionBankId',
                as: 'Items'
            });
        }
    }

    QuestionBank.init({
        Ten: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        Mota: {
            type: DataTypes.TEXT
        },
        FilePath: {
            type: DataTypes.STRING(500)
        },
        FileType: {
            type: DataTypes.ENUM('pdf', 'docx', 'txt')
        },
        FileName: {
            type: DataTypes.STRING(255)
        },
        Content: {
            type: DataTypes.TEXT('long')
        },
        Metadata: {
            type: DataTypes.JSON,
            defaultValue: {}
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'QuestionBank',
        tableName: 'QuestionBank',
        timestamps: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return QuestionBank;
};

