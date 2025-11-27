'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('TestQuestion', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            Cauhoi: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'Nội dung câu hỏi'
            },
            Dapan: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'Đáp án chuẩn của HR'
            },
            Loaicauhoi: {
                type: Sequelize.ENUM('tuluan', 'tracnghiem'),
                defaultValue: 'tuluan',
                comment: 'Loại câu hỏi: tự luận hoặc trắc nghiệm'
            },
            Diem: {
                type: Sequelize.INTEGER,
                defaultValue: 10,
                comment: 'Điểm của câu hỏi này'
            },
            Thutu: {
                type: Sequelize.INTEGER,
                defaultValue: 1,
                comment: 'Thứ tự hiển thị câu hỏi'
            },
            testId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Test',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'ID bài test'
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
        await queryInterface.addIndex('TestQuestion', ['testId'], {
            name: 'idx_testquestion_test'
        });
        await queryInterface.addIndex('TestQuestion', ['testId', 'Thutu'], {
            name: 'idx_testquestion_test_order'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('TestQuestion');
    }
};

