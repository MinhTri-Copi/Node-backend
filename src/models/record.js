'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Record extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Record.belongsTo(models.User, {foreignKey: 'userId'});
      Record.hasMany(models.JobApplication, {foreignKey: 'recordId'})
    }
  }
  Record.init({
    Mahoso: DataTypes.INTEGER,
    Tieude: DataTypes.STRING,
    File_url: DataTypes.STRING,
    Ngaytao: DataTypes.DATEONLY,
    userId: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Record',
  });
  return Record;
};
