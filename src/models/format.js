'use strict';
const {
  Model,
  DATE
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Format extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      Format.hasMany(models.JobPosting, {foreignKey:  'formatId'});
      
    }
  }
  Format.init({
    TenHinhThuc: DataTypes.STRING,
  }, {
    sequelize,      
    modelName: 'Format',
  });
  return Format;
};
