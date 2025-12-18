'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class JobPostingEmbedding extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            JobPostingEmbedding.belongsTo(models.JobPosting, {
                foreignKey: 'jobPostingId',
                as: 'JobPosting'
            });
        }
    }
    JobPostingEmbedding.init({
        jobPostingId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true
        },
        embedding: {
            type: DataTypes.TEXT('long'),
            allowNull: true,
            comment: 'JSON array của embedding vector'
        },
        modelVersion: {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: 'all-MiniLM-L6-v2'
        },
        jdEmbeddingUpdatedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'JobPostingEmbedding',
        tableName: 'JobPostingEmbedding'
    });
    return JobPostingEmbedding;
};

