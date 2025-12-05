'use strict';
const {
  Model,
  DATE
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Major extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      Major.belongsToMany(models.JobPosting,{
        through:'MajorJobPosting',
        foreignKey: 'majorId',
        otherKey: 'jobPostingId',
      })
    }
  }
  Major.init({
    TenNghanhNghe: DataTypes.STRING,
  }, {
    sequelize,      
    modelName: 'Major',
  });
  return Major;
};
