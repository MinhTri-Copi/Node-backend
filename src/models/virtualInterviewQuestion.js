'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VirtualInterviewQuestion extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      VirtualInterviewQuestion.belongsTo(models.VirtualInterview, {
        foreignKey: 'virtualInterviewId',
        as: 'VirtualInterview'
      });
      VirtualInterviewQuestion.hasOne(models.VirtualInterviewAnswer, {
        foreignKey: 'questionId',
        as: 'Answer'
      });
    }
  }
  VirtualInterviewQuestion.init({
    virtualInterviewId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'VirtualInterview',
        key: 'id'
      }
    },
    questionText: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    topic: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    level: {
      type: DataTypes.ENUM('intern', 'junior', 'middle', 'senior'),
      allowNull: false
    },
    language: {
      type: DataTypes.ENUM('vi', 'en'),
      allowNull: false
    },
    questionOrder: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    maxScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10
    },
    difficulty: {
      type: DataTypes.ENUM('easy', 'medium', 'hard'),
      allowNull: false,
      defaultValue: 'medium'
    },
    questionType: {
      type: DataTypes.ENUM('concept', 'application', 'optimization', 'design'),
      allowNull: false,
      defaultValue: 'application'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'VirtualInterviewQuestion',
    tableName: 'VirtualInterviewQuestion',
    indexes: [
      {
        fields: ['virtualInterviewId']
      },
      {
        fields: ['virtualInterviewId', 'questionOrder']
      }
    ]
  });
  return VirtualInterviewQuestion;
};

