'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.createTable('jobpostingstatus', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        TenTrangThai: {
          type: Sequelize.STRING(255),
          allowNull: false
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
      
      console.log('✓ Đã tạo bảng jobpostingstatus');
      
      // Insert default statuses
      await queryInterface.bulkInsert('jobpostingstatus', [
        {
          TenTrangThai: 'Đang tuyển',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          TenTrangThai: 'Ngừng tuyển',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          TenTrangThai: 'Hết hạn',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          TenTrangThai: 'Bản nháp',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      
      console.log('✓ Đã insert default job posting statuses');
    } catch (error) {
      console.error('Lỗi khi tạo bảng jobpostingstatus:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.dropTable('jobpostingstatus');
      console.log('✓ Đã xóa bảng jobpostingstatus');
    } catch (error) {
      console.error('Lỗi khi xóa bảng:', error);
      throw error;
    }
  }
};

