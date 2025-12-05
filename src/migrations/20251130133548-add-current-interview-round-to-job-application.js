'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('JobApplication', 'currentInterviewRoundId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'InterviewRound',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Vòng phỏng vấn hiện tại của ứng viên'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('JobApplication', 'currentInterviewRoundId');
  }
};
