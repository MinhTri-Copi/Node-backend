'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Recruiter extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Recruiter.belongsTo(models.Company, {foreignKey: 'companyId'});
    Recruiter.belongsTo(models.User, {foreignKey: 'userId'});
    Recruiter.hasMany(models.JobPosting, { foreignKey: 'recruiterId' });


    }
  }
  Recruiter.init({
       Hoten: DataTypes.STRING,
    Chucvu: DataTypes.STRING,
    SDT: DataTypes.STRING,
    userId: DataTypes.INTEGER,
    companyId: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Recruiter',
  });
  return Recruiter;
};
