'use strict';
const {
  Model,
  DATE
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class JobApplication extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      JobApplication.belongsTo(models.JobPosting, { foreignKey: 'jobPostingId' });
      
      JobApplication.belongsTo(models.ApplicationStatus, { foreignKey: 'applicationStatusId' });
      
      JobApplication.belongsTo(models.Record, { foreignKey: 'recordId' });
      
      JobApplication.hasMany(models.TestSubmission, {
        foreignKey: 'jobApplicationId',
        as: 'TestSubmissions'
      });
      
      JobApplication.hasMany(models.Meeting, {
        foreignKey: 'jobApplicationId',
        as: 'Meetings'
      });
      
      JobApplication.belongsTo(models.InterviewRound, {
        foreignKey: 'currentInterviewRoundId',
        as: 'CurrentInterviewRound'
      });
      
      JobApplication.hasMany(models.ApplicationDocument, {
        foreignKey: 'jobApplicationId',
        as: 'ApplicationDocuments'
      });
    }
  }
  JobApplication.init({
    Thugioithieu: DataTypes.TEXT, 
    Ngaynop: DataTypes.DATE,       
    Ngaycapnhat: DataTypes.DATE,   
    
    jobPostingId: DataTypes.INTEGER,
    applicationStatusId: DataTypes.INTEGER,
    recordId: DataTypes.INTEGER,
    currentInterviewRoundId: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'JobApplication',
  });
  return JobApplication;
};
