'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CandidateCV', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID của candidate (user)'
      },
      cvFilePath: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Đường dẫn file CV (PDF/DOCX)'
      },
      cvText: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'Text đã extract từ CV'
      },
      cvEmbedding: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'JSON array của embedding vector (optional, có thể tính real-time)'
      },
      fileHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        comment: 'MD5/SHA256 hash của file để detect duplicate và cache'
      },
      extractionStatus: {
        type: Sequelize.ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED'),
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Trạng thái extract text: PENDING, PROCESSING, READY, FAILED'
      },
      modelVersion: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Version của embedding model (để biết embedding thuộc model nào)'
      },
      extractedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Thời điểm extract text thành công'
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Thông báo lỗi nếu extractionStatus = FAILED'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Tạo index cho userId để query nhanh
    await queryInterface.addIndex('CandidateCV', ['userId'], {
      name: 'idx_candidate_cv_user_id'
    });

    // Tạo index cho fileHash để check duplicate nhanh
    await queryInterface.addIndex('CandidateCV', ['fileHash'], {
      name: 'idx_candidate_cv_file_hash',
      unique: false
    });

    // Tạo index cho extractionStatus để query các CV đang chờ xử lý
    await queryInterface.addIndex('CandidateCV', ['extractionStatus'], {
      name: 'idx_candidate_cv_extraction_status'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('CandidateCV');
  }
};

