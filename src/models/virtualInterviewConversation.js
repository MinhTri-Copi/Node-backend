'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VirtualInterviewConversation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      VirtualInterviewConversation.belongsTo(models.VirtualInterview, {
        foreignKey: 'virtualInterviewId',
        as: 'VirtualInterview'
      });
    }
  }
  VirtualInterviewConversation.init({
    virtualInterviewId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'VirtualInterview',
        key: 'id'
      }
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant', 'system'),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    messageOrder: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    audioUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'VirtualInterviewConversation',
    tableName: 'VirtualInterviewConversation',
    indexes: [
      {
        fields: ['virtualInterviewId']
      },
      {
        fields: ['virtualInterviewId', 'messageOrder']
      }
    ]
  });
  return VirtualInterviewConversation;
};

