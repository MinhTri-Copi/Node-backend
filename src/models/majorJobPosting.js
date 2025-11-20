'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MajorJobPosting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

    }
  }
  MajorJobPosting.init({
   majorId: DataTypes.INTEGER,
   jobPostingId: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'MajorJobPosting',
  });
  return MajorJobPosting;
};
