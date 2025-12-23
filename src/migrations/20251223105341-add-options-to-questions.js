'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add Options field to QuestionBankItem (use Metadata if exists, or add new field)
    // Check if Metadata column exists and can store options
    // For now, we'll add a dedicated Options column
    
    // Add Options to QuestionBankItem
    await queryInterface.addColumn('QuestionBankItem', 'Options', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Các lựa chọn cho câu trắc nghiệm (A, B, C, D) - Format: {A: "text", B: "text", C: "text", D: "text"}'
    });

    // Add Options to TestQuestion
    await queryInterface.addColumn('TestQuestion', 'Options', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Các lựa chọn cho câu trắc nghiệm (A, B, C, D) - Format: {A: "text", B: "text", C: "text", D: "text"}'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove Options column from both tables
    await queryInterface.removeColumn('QuestionBankItem', 'Options');
    await queryInterface.removeColumn('TestQuestion', 'Options');
  }
};
