'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Thêm các columns cho CV extraction vào bảng Record
    await queryInterface.addColumn('Record', 'cvText', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Text đã extract từ CV'
    });

    await queryInterface.addColumn('Record', 'cvEmbedding', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'JSON array của embedding vector'
    });

    await queryInterface.addColumn('Record', 'fileHash', {
      type: Sequelize.STRING(64),
      allowNull: true,
      comment: 'MD5/SHA256 hash của file để detect duplicate và cache'
    });

    await queryInterface.addColumn('Record', 'extractionStatus', {
      type: Sequelize.ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED'),
      allowNull: true,
      defaultValue: 'PENDING',
      comment: 'Trạng thái extract text: PENDING, PROCESSING, READY, FAILED'
    });

    await queryInterface.addColumn('Record', 'modelVersion', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Version của embedding model'
    });

    await queryInterface.addColumn('Record', 'extractedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Thời điểm extract text thành công'
    });

    await queryInterface.addColumn('Record', 'errorMessage', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Thông báo lỗi nếu extractionStatus = FAILED'
    });

    // Tạo index cho fileHash
    await queryInterface.addIndex('Record', ['fileHash'], {
      name: 'idx_record_file_hash'
    });

    // Tạo index cho extractionStatus
    await queryInterface.addIndex('Record', ['extractionStatus'], {
      name: 'idx_record_extraction_status'
    });
  },

  async down(queryInterface, Sequelize) {
    // Xóa indexes
    await queryInterface.removeIndex('Record', 'idx_record_file_hash');
    await queryInterface.removeIndex('Record', 'idx_record_extraction_status');

    // Xóa columns
    await queryInterface.removeColumn('Record', 'cvText');
    await queryInterface.removeColumn('Record', 'cvEmbedding');
    await queryInterface.removeColumn('Record', 'fileHash');
    await queryInterface.removeColumn('Record', 'extractionStatus');
    await queryInterface.removeColumn('Record', 'modelVersion');
    await queryInterface.removeColumn('Record', 'extractedAt');
    await queryInterface.removeColumn('Record', 'errorMessage');
  }
};

