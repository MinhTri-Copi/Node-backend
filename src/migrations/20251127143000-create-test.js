'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Test', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            Tieude: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Tiêu đề bài test'
            },
            Mota: {
                type: Sequelize.TEXT,
                comment: 'Mô tả chi tiết bài test'
            },
            Thoigiantoida: {
                type: Sequelize.INTEGER,
                defaultValue: 60,
                comment: 'Thời gian tối đa làm bài (phút)'
            },
            Ngaybatdau: {
                type: Sequelize.DATE,
                comment: 'Ngày bắt đầu có hiệu lực'
            },
            Ngayhethan: {
                type: Sequelize.DATE,
                comment: 'Ngày hết hạn - deadline'
            },
            Tongdiem: {
                type: Sequelize.INTEGER,
                defaultValue: 100,
                comment: 'Tổng điểm của bài test'
            },
            Trangthai: {
                type: Sequelize.TINYINT,
                defaultValue: 1,
                comment: '1: Active, 0: Inactive'
            },
            jobPostingId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'JobPosting',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'ID tin tuyển dụng'
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
        await queryInterface.addIndex('Test', ['jobPostingId'], {
            name: 'idx_test_jobposting'
        });
        await queryInterface.addIndex('Test', ['Trangthai'], {
            name: 'idx_test_status'
        });
        await queryInterface.addIndex('Test', ['Ngayhethan'], {
            name: 'idx_test_deadline'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Test');
    }
};

