'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('VirtualInterviewTopicScore', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            virtualInterviewId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'VirtualInterview',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            topic: {
                type: Sequelize.STRING(100),
                allowNull: false,
                comment: 'VD: Java'
            },
            totalQuestions: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'Số câu hỏi của topic này'
            },
            totalScore: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false,
                comment: 'Tổng điểm đạt được'
            },
            maxScore: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false,
                comment: 'Tổng điểm tối đa'
            },
            averageScore: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false,
                comment: 'Điểm trung bình'
            },
            percentage: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false,
                comment: 'Phần trăm: averageScore/maxScore * 100'
            },
            feedback: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Nhận xét riêng cho topic này - bằng ngôn ngữ của phiên phỏng vấn'
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

        // Add indexes
        await queryInterface.addIndex('VirtualInterviewTopicScore', ['virtualInterviewId']);
        await queryInterface.addIndex('VirtualInterviewTopicScore', ['virtualInterviewId', 'topic'], {
            unique: true,
            name: 'unique_interview_topic'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('VirtualInterviewTopicScore');
    }
};

