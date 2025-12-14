'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ApplicationDocument extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ApplicationDocument.belongsTo(models.JobApplication, {
        foreignKey: 'jobApplicationId',
        as: 'JobApplication'
      });
    }
  }
  ApplicationDocument.init({
    jobApplicationId: DataTypes.INTEGER,
    documentType: {
      type: DataTypes.ENUM(
        'job_application_letter',
        'id_card_copy',
        'resume_certified',
        'degree_certified',
        'health_certificate',
        'bank_account'
      ),
      allowNull: false
    },
    fileUrl: DataTypes.STRING(500),
    expiryDate: DataTypes.DATEONLY,
    bankAccountNumber: DataTypes.STRING(50),
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    notes: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'ApplicationDocument',
  });
  return ApplicationDocument;
};

