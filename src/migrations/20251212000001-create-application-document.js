'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ApplicationDocument', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      jobApplicationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'JobApplication',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      documentType: {
        type: Sequelize.ENUM(
          'job_application_letter',      // Đơn xin việc
          'id_card_copy',                  // Bản sao Căn cước công dân
          'resume_certified',              // Sơ yếu lý lịch có chứng thực
          'degree_certified',              // Bản sao bằng cấp có chứng thực
          'health_certificate',             // Giấy khám sức khỏe
          'bank_account'                   // Số tài khoản ngân hàng
        ),
        allowNull: false
      },
      fileUrl: {
        type: Sequelize.STRING(500),
        allowNull: true  // Null for bank_account type
      },
      expiryDate: {
        type: Sequelize.DATEONLY,
        allowNull: true  // Only for id_card_copy and health_certificate
      },
      bankAccountNumber: {
        type: Sequelize.STRING(50),
        allowNull: true  // Only for bank_account type
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        allowNull: false
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ApplicationDocument');
  }
};

