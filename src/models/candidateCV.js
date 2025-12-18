'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class CandidateCV extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            CandidateCV.belongsTo(models.User, {
                foreignKey: 'userId',
                as: 'User'
            });
        }
    }
    CandidateCV.init({
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        cvFilePath: {
            type: DataTypes.STRING(500),
            allowNull: false
        },
        cvText: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },
        cvEmbedding: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },
        fileHash: {
            type: DataTypes.STRING(64),
            allowNull: false
        },
        extractionStatus: {
            type: DataTypes.ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED'),
            allowNull: false,
            defaultValue: 'PENDING'
        },
        modelVersion: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        extractedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'CandidateCV',
        tableName: 'CandidateCV'
    });
    return CandidateCV;
};

