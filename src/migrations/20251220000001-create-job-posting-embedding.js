'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('JobPostingEmbedding', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      jobPostingId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'JobPosting',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID của job posting'
      },
      embedding: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'JSON array của embedding vector (384 dimensions cho all-MiniLM-L6-v2)'
      },
      modelVersion: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'all-MiniLM-L6-v2',
        comment: 'Version của embedding model (để biết embedding thuộc model nào)'
      },
      jdEmbeddingUpdatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Thời điểm cập nhật embedding lần cuối'
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

    // Tạo index cho jobPostingId (đã unique nên tự động có index)
    // Tạo index cho modelVersion để query nhanh hơn
    await queryInterface.addIndex('JobPostingEmbedding', ['modelVersion'], {
      name: 'idx_job_posting_embedding_model_version'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('JobPostingEmbedding');
  }
};

