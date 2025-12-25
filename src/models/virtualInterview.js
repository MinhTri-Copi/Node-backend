'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VirtualInterview extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      VirtualInterview.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'User'
      });
      VirtualInterview.hasMany(models.VirtualInterviewQuestion, {
        foreignKey: 'virtualInterviewId',
        as: 'Questions'
      });
      VirtualInterview.hasMany(models.VirtualInterviewAnswer, {
        foreignKey: 'virtualInterviewId',
        as: 'Answers'
      });
      VirtualInterview.hasMany(models.VirtualInterviewTopicScore, {
        foreignKey: 'virtualInterviewId',
        as: 'TopicScores'
      });
      VirtualInterview.hasMany(models.VirtualInterviewConversation, {
        foreignKey: 'virtualInterviewId',
        as: 'Conversations'
      });
    }
  }
  VirtualInterview.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    level: {
      type: DataTypes.ENUM('intern', 'junior', 'middle', 'senior'),
      allowNull: false
    },
    language: {
      type: DataTypes.ENUM('vi', 'en'),
      allowNull: false,
      defaultValue: 'vi'
    },
    topics: {
      type: DataTypes.JSON,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('draft', 'in_progress', 'completed', 'abandoned'),
      allowNull: false,
      defaultValue: 'draft'
    },
    totalQuestions: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    totalScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    maxScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    levelScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    overallFeedback: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    improvementSuggestions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isForPractice: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'VirtualInterview',
    tableName: 'VirtualInterview',
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['userId', 'createdAt']
      }
    ]
  });
  return VirtualInterview;
};

