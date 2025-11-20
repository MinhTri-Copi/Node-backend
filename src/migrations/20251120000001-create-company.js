'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Company', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
    
      Tencongty: {
        type: Sequelize.STRING
      },
      Nganhnghe: {
        type: Sequelize.STRING
      },
      Quymo: {
        type: Sequelize.STRING
      },
      Diachi: {
        type: Sequelize.STRING
      },
      Website: {
        type: Sequelize.STRING
      },
      Mota: {
        type: Sequelize.TEXT
      },
      Ngaythanhgia: {
        type: Sequelize.DATE
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
    await queryInterface.dropTable('Company');
  }
};
