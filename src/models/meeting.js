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
    },
    invitation_status: {
      type: DataTypes.ENUM('SENT', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'CANCELLED', 'COMPLETED'),
      defaultValue: 'SENT',
      allowNull: false,
      comment: 'Trạng thái phản hồi của ứng viên về lời mời phỏng vấn'
    },
    rejection_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Số lần từ chối/đổi lịch của ứng viên'
    },
    candidate_reschedule_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do từ chối/đổi lịch của ứng viên'
    },
    interview_token: {
      type: DataTypes.STRING(500),
      allowNull: true,
      unique: true,
      comment: 'Token định danh duy nhất cho link trong email (JWT)'
    },
    evaluation_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Khóa đánh giá - không cho phép chỉnh sửa khi đã đánh giá hoặc đã duyệt ứng viên'
    },
    recordingUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL recording từ Jitsi (sau khi meeting kết thúc)'
    },
    recordingStatus: {
      type: DataTypes.ENUM('not_started', 'recording', 'processing', 'ready', 'failed'),
      defaultValue: 'not_started',
      allowNull: false,
      comment: 'Trạng thái recording: not_started/recording/processing/ready/failed'
    },
    recordingStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian bắt đầu recording'
    },
    recordingFinishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian kết thúc recording'
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
      },
      {
        fields: ['interview_token'],
        unique: true
      }
    ]
  });
  return Meeting;
};

