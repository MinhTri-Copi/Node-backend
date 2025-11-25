'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      User.belongsTo(models.Role, {foreignKey: 'roleId'});
      User.hasMany(models.Recruiter, {foreignKey: 'userId'});
      User.hasMany(models.Record, {foreignKey: 'userId'});
    }
  }
  User.init({
    Hoten: DataTypes.STRING,
    email: DataTypes.STRING,
    SDT: DataTypes.STRING,
    matKhau: DataTypes.STRING,
    ngayTaoTaiKhoan : DataTypes.STRING,
    lanDangNhapCuoiCung : DataTypes.STRING,
    roleId: DataTypes.INTEGER,
    
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};