'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if column Trangthai exists, if yes then rename it
      const [columns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM jobposting WHERE Field = 'Trangthai'"
      );
      
      if (columns.length > 0) {
        await queryInterface.renameColumn('jobposting', 'Trangthai', 'TrangthaiId');
        console.log('✓ Đã đổi tên cột Trangthai thành TrangthaiId trong bảng jobposting');
      } else {
        console.log('ℹ Cột TrangthaiId đã tồn tại, bỏ qua bước rename');
      }
      
      // Change column type from TINYINT to INTEGER FIRST (without foreign key)
      await queryInterface.changeColumn('jobposting', 'TrangthaiId', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
      console.log('✓ Đã đổi kiểu dữ liệu TrangthaiId từ TINYINT sang INTEGER');
      
      // Update existing data: convert old status (0/1) to new status IDs
      // Assuming: 1 (active) -> 1 (Đang tuyển), 0 (inactive) -> 2 (Ngừng tuyển)
      await queryInterface.sequelize.query(`
        UPDATE jobposting 
        SET TrangthaiId = CASE 
          WHEN TrangthaiId = 1 THEN 1
          WHEN TrangthaiId = 0 THEN 2
          ELSE 1
        END
      `);
      console.log('✓ Đã cập nhật dữ liệu cũ sang status mới');
      
      // Now add foreign key constraint
      await queryInterface.addConstraint('jobposting', {
        fields: ['TrangthaiId'],
        type: 'foreign key',
        name: 'fk_jobposting_status',
        references: {
          table: 'jobpostingstatus',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      console.log('✓ Đã thêm foreign key constraint cho TrangthaiId');
      
    } catch (error) {
      console.error('Lỗi khi cập nhật jobposting:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Remove foreign key constraint first
      await queryInterface.removeConstraint('jobposting', 'fk_jobposting_status');
      console.log('✓ Đã xóa foreign key constraint');
      
      // Change column type back to TINYINT
      await queryInterface.changeColumn('jobposting', 'TrangthaiId', {
        type: Sequelize.TINYINT,
        allowNull: true
      });
      console.log('✓ Đã đổi kiểu dữ liệu TrangthaiId về TINYINT');
      
      // Rename back
      await queryInterface.renameColumn('jobposting', 'TrangthaiId', 'Trangthai');
      console.log('✓ Đã rollback cột TrangthaiId về Trangthai');
    } catch (error) {
      console.error('Lỗi khi rollback:', error);
      throw error;
    }
  }
};

