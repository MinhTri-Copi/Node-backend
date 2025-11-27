'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('TestSubmission', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            Thoigianbatdau: {
                type: Sequelize.DATE,
                comment: 'Thời điểm ứng viên bắt đầu làm bài'
            },
            Thoigianketthuc: {
                type: Sequelize.DATE,
                comment: 'Thời điểm ứng viên nộp bài hoặc hết giờ'
            },
            Thoigianconlai: {
                type: Sequelize.INTEGER,
                comment: 'Số phút còn lại (nếu làm dở)'
            },
            Hanhethan: {
                type: Sequelize.DATE,
                comment: 'Deadline - phải nộp trước thời điểm này'
            },
            Tongdiemdatduoc: {
                type: Sequelize.FLOAT,
                defaultValue: 0,
                comment: 'Tổng điểm đạt được'
            },
            Trangthai: {
                type: Sequelize.ENUM('chuabatdau', 'danglam', 'danop', 'dacham', 'hethan', 'huy'),
                defaultValue: 'chuabatdau',
                comment: 'Trạng thái làm bài'
            },
            Ghichu: {
                type: Sequelize.TEXT,
                comment: 'Ghi chú (lý do hủy, quá hạn...)'
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
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'User',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'ID ứng viên'
            },
            jobApplicationId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'JobApplication',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'ID đơn ứng tuyển (nếu có)'
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
        await queryInterface.addIndex('TestSubmission', ['testId'], {
            name: 'idx_testsubmission_test'
        });
        await queryInterface.addIndex('TestSubmission', ['userId'], {
            name: 'idx_testsubmission_user'
        });
        await queryInterface.addIndex('TestSubmission', ['Trangthai'], {
            name: 'idx_testsubmission_status'
        });
        await queryInterface.addIndex('TestSubmission', ['Hanhethan'], {
            name: 'idx_testsubmission_deadline'
        });
        
        // Unique constraint: Mỗi user chỉ làm 1 lần mỗi test
        await queryInterface.addConstraint('TestSubmission', {
            fields: ['testId', 'userId'],
            type: 'unique',
            name: 'unique_test_user'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('TestSubmission');
    }
};

