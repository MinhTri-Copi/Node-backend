'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.renameColumn('major', 'TenHinhThuc', 'TenNghanhNghe');
      console.log('✓ Đã đổi tên cột TenHinhThuc thành TenNghanhNghe trong bảng major');
    } catch (error) {
      console.error('Lỗi khi đổi tên cột:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.renameColumn('major', 'TenNghanhNghe', 'TenHinhThuc');
      console.log('✓ Đã đổi tên cột TenNghanhNghe về TenHinhThuc trong bảng major');
    } catch (error) {
      console.error('Lỗi khi rollback:', error);
      throw error;
    }
  }
};

