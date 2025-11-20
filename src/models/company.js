'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Company extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Company.hasMany(models.Recruiter, {foreignKey: 'companyId'});
      Company.hasMany(models.JobPosting, {foreignKey : 'companyId'})
    }
  }
  Company.init({
    Tencongty: DataTypes.STRING,
    Nganhnghe: DataTypes.STRING,
    Quymo: DataTypes.STRING,
    Diachi: DataTypes.STRING,
    Website: DataTypes.STRING,
    Mota: DataTypes.STRING,
    Ngaythanhgia: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Company',
  });
  return Company;
};
