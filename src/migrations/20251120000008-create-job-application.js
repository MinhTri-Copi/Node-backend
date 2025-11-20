'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('JobApplication', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      Thugioithieu: {
        type: Sequelize.TEXT
      },
      Ngaynop: {
        type: Sequelize.DATE
      },
      Ngaycapnhat: {
        type: Sequelize.DATE
      },
      jobPostingId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'JobPosting',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      applicationStatusId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'ApplicationStatus',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      recordId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Record',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    await queryInterface.dropTable('JobApplication');
  }
};
