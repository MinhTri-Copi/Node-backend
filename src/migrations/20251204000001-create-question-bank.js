'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('QuestionBank', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            Ten: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Tên bộ đề'
            },
            Mota: {
                type: Sequelize.TEXT,
                comment: 'Mô tả bộ đề'
            },
            FilePath: {
                type: Sequelize.STRING(500),
                comment: 'Đường dẫn file upload (PDF/Word/TXT)'
            },
            FileType: {
                type: Sequelize.ENUM('pdf', 'docx', 'txt'),
                comment: 'Loại file: pdf, docx, txt'
            },
            FileName: {
                type: Sequelize.STRING(255),
                comment: 'Tên file gốc'
            },
            Content: {
                type: Sequelize.TEXT('long'),
                comment: 'Nội dung đã parse từ file (text thuần)'
            },
            Metadata: {
                type: Sequelize.JSON,
                comment: 'Metadata: số câu hỏi, chủ đề, kích thước file, etc.'
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
                comment: 'ID HR tạo bộ đề'
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
            }
        }, {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        });

        // Add indexes
        await queryInterface.addIndex('QuestionBank', ['userId'], {
            name: 'idx_questionbank_user'
        });
        await queryInterface.addIndex('QuestionBank', ['FileType'], {
            name: 'idx_questionbank_filetype'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('QuestionBank');
    }
};

