'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VirtualInterviewTopicScore extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      VirtualInterviewTopicScore.belongsTo(models.VirtualInterview, {
        foreignKey: 'virtualInterviewId',
        as: 'VirtualInterview'
      });
    }
  }
  VirtualInterviewTopicScore.init({
    virtualInterviewId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'VirtualInterview',
        key: 'id'
      }
    },
    topic: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    totalQuestions: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    totalScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    maxScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    averageScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'VirtualInterviewTopicScore',
    tableName: 'VirtualInterviewTopicScore',
    indexes: [
      {
        fields: ['virtualInterviewId']
      },
      {
        unique: true,
        fields: ['virtualInterviewId', 'topic'],
        name: 'unique_interview_topic'
      }
    ]
  });
  return VirtualInterviewTopicScore;
};

