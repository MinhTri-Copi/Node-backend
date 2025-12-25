'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VirtualInterviewAnswer extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      VirtualInterviewAnswer.belongsTo(models.VirtualInterview, {
        foreignKey: 'virtualInterviewId',
        as: 'VirtualInterview'
      });
      VirtualInterviewAnswer.belongsTo(models.VirtualInterviewQuestion, {
        foreignKey: 'questionId',
        as: 'Question'
      });
    }
  }
  VirtualInterviewAnswer.init({
    virtualInterviewId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'VirtualInterview',
        key: 'id'
      }
    },
    questionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'VirtualInterviewQuestion',
        key: 'id'
      }
    },
    answerText: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    similarityScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true
    },
    gradedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    gradingMethod: {
      type: DataTypes.STRING(50),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'VirtualInterviewAnswer',
    tableName: 'VirtualInterviewAnswer',
    indexes: [
      {
        fields: ['virtualInterviewId']
      },
      {
        fields: ['questionId']
      },
      {
        unique: true,
        fields: ['virtualInterviewId', 'questionId'],
        name: 'unique_interview_question_answer'
      }
    ]
  });
  return VirtualInterviewAnswer;
};

