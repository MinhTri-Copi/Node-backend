'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('User', 'SDT', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'email'
      });
      console.log('✓ Đã thêm cột SDT vào bảng Users');
    } catch (error) {
      console.error('Lỗi khi thêm cột SDT:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('User', 'SDT');
      console.log('✓ Đã xóa cột SDT khỏi bảng Users');
    } catch (error) {
      console.error('Lỗi khi xóa cột SDT:', error);
      throw error;
    }
  }
};


