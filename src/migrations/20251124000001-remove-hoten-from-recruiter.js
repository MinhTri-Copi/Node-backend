'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('recruiter', 'Hoten');
      console.log('✓ Đã xóa cột Hoten từ bảng recruiter');
    } catch (error) {
      console.error('Lỗi khi xóa cột Hoten:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('recruiter', 'Hoten', {
        type: Sequelize.STRING(255),
        allowNull: true,
        after: 'id'
      });
      console.log('✓ Đã thêm lại cột Hoten vào bảng recruiter');
    } catch (error) {
      console.error('Lỗi khi thêm lại cột Hoten:', error);
      throw error;
    }
  }
};

