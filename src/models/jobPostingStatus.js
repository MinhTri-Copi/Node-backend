'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class JobPostingStatus extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      JobPostingStatus.hasMany(models.JobPosting, { foreignKey: 'TrangthaiId' });
    }
  }
  JobPostingStatus.init({
    TenTrangThai: DataTypes.STRING(255)
  }, {
    sequelize,
    modelName: 'JobPostingStatus',
  });
  return JobPostingStatus;
};

