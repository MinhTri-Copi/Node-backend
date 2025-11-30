'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Meeting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Meeting.belongsTo(models.InterviewRound, {
        foreignKey: 'interviewRoundId',
        as: 'InterviewRound'
      });
      
      Meeting.belongsTo(models.JobApplication, {
        foreignKey: 'jobApplicationId',
        as: 'JobApplication'
      });
      
      Meeting.belongsTo(models.User, {
        foreignKey: 'hrUserId',
        as: 'HR'
      });
      
      Meeting.belongsTo(models.User, {
        foreignKey: 'candidateUserId',
        as: 'Candidate'
      });
    }
  }
  Meeting.init({
    interviewRoundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'InterviewRound',
        key: 'id'
      }
    },
    jobApplicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'JobApplication',
        key: 'id'
      }
    },
    hrUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    candidateUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'User',
        key: 'id'
      }
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Thời gian bắt đầu phỏng vấn'
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian kết thúc (log)'
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'done', 'cancel', 'rescheduled'),
      defaultValue: 'pending',
      allowNull: false
    },
    roomName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Tên phòng Jitsi (unique)'
    },
    meetingUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL phòng video call Jitsi (có thể tự động generate từ roomName)'
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Điểm đánh giá (0-100)'
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Nhận xét của HR'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú thêm'
    }
  }, {
    sequelize,
    modelName: 'Meeting',
    tableName: 'Meeting',
    indexes: [
      {
        fields: ['interviewRoundId']
      },
      {
        fields: ['jobApplicationId']
      },
      {
        fields: ['hrUserId']
      },
      {
        fields: ['candidateUserId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['scheduledAt']
      },
      {
        fields: ['roomName']
      }
    ]
  });
  return Meeting;
};

