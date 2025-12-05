'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Meeting', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            interviewRoundId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'InterviewRound',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'Thuộc vòng phỏng vấn nào'
            },
            jobApplicationId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'JobApplication',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'Thuộc đơn ứng tuyển nào'
            },
            hrUserId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'User',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
                comment: 'HR nào phỏng vấn'
            },
            candidateUserId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'User',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
                comment: 'Ứng viên nào được phỏng vấn'
            },
            scheduledAt: {
                type: Sequelize.DATE,
                allowNull: false,
                comment: 'Thời gian bắt đầu phỏng vấn'
            },
            finishedAt: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Thời gian kết thúc (log)'
            },
            status: {
                type: Sequelize.ENUM('pending', 'running', 'done', 'cancel', 'rescheduled'),
                defaultValue: 'pending',
                allowNull: false,
                comment: 'Trạng thái: pending/running/done/cancel/rescheduled'
            },
            roomName: {
                type: Sequelize.STRING(255),
                allowNull: false,
                unique: true,
                comment: 'Tên phòng Jitsi (unique)'
            },
            meetingUrl: {
                type: Sequelize.STRING(500),
                allowNull: true,
                comment: 'URL phòng video call Jitsi (có thể tự động generate từ roomName)'
            },
            score: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: true,
                comment: 'Điểm đánh giá vòng đó (0-100)'
            },
            feedback: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Nhận xét của HR'
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Ghi chú thêm (có thể dùng cho cả HR và ứng viên)'
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

        // Thêm indexes để query nhanh hơn
        await queryInterface.addIndex('Meeting', ['interviewRoundId']);
        await queryInterface.addIndex('Meeting', ['jobApplicationId']);
        await queryInterface.addIndex('Meeting', ['hrUserId']);
        await queryInterface.addIndex('Meeting', ['candidateUserId']);
        await queryInterface.addIndex('Meeting', ['status']);
        await queryInterface.addIndex('Meeting', ['scheduledAt']);
        await queryInterface.addIndex('Meeting', ['roomName']);
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('Meeting');
    }
};

