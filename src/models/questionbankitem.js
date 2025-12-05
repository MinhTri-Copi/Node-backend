'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class QuestionBankItem extends Model {
        static associate(models) {
            // QuestionBankItem belongs to QuestionBank
            QuestionBankItem.belongsTo(models.QuestionBank, {
                foreignKey: 'questionBankId',
                as: 'QuestionBank'
            });
        }
    }

    QuestionBankItem.init({
        Cauhoi: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        Dapan: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        Chude: {
            type: DataTypes.STRING(100)
        },
        Loaicauhoi: {
            type: DataTypes.ENUM('tuluan', 'tracnghiem'),
            defaultValue: 'tuluan'
        },
        Diem: {
            type: DataTypes.INTEGER,
            defaultValue: 10
        },
        Dodai: {
            type: DataTypes.ENUM('ngan', 'trungbinh', 'dai'),
            defaultValue: 'trungbinh'
        },
        Dokho: {
            type: DataTypes.ENUM('de', 'trungbinh', 'kho'),
            defaultValue: 'trungbinh'
        },
        Metadata: {
            type: DataTypes.JSON,
            defaultValue: {}
        },
        questionBankId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'QuestionBankItem',
        tableName: 'QuestionBankItem',
        timestamps: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return QuestionBankItem;
};

