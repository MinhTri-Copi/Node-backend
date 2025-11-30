'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class InterviewRound extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      InterviewRound.belongsTo(models.JobPosting, {
        foreignKey: 'jobPostingId',
        as: 'JobPosting'
      });
      
      InterviewRound.hasMany(models.Meeting, {
        foreignKey: 'interviewRoundId',
        as: 'Meetings'
      });
    }
  }
  InterviewRound.init({
    jobPostingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'JobPosting',
        key: 'id'
      }
    },
    roundNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Số vòng: 1, 2, 3...'
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Tên vòng phỏng vấn'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Thời lượng phút'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú / nội dung vòng'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Vòng phỏng vấn có đang hoạt động không'
    }
  }, {
    sequelize,
    modelName: 'InterviewRound',
    tableName: 'InterviewRound',
    indexes: [
      {
        fields: ['jobPostingId']
      },
      {
        unique: true,
        fields: ['jobPostingId', 'roundNumber'],
        name: 'unique_job_round'
      }
    ]
  });
  return InterviewRound;
};

