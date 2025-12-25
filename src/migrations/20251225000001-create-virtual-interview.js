'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('VirtualInterview', {
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
                onDelete: 'CASCADE'
            },
            level: {
                type: Sequelize.ENUM('intern', 'junior', 'middle', 'senior'),
                allowNull: false
            },
            language: {
                type: Sequelize.ENUM('vi', 'en'),
                allowNull: false,
                defaultValue: 'vi',
                comment: 'Ngôn ngữ của phiên phỏng vấn - cố định trong suốt phiên'
            },
            topics: {
                type: Sequelize.JSON,
                allowNull: false,
                comment: 'Array of topic strings: ["Java", "React", ...]'
            },
            status: {
                type: Sequelize.ENUM('draft', 'in_progress', 'completed', 'abandoned'),
                allowNull: false,
                defaultValue: 'draft'
            },
            totalQuestions: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'Số câu hỏi đã sinh'
            },
            startedAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            completedAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            totalScore: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: true,
                comment: 'Điểm tổng sau khi chấm'
            },
            maxScore: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: true,
                comment: 'Tổng điểm tối đa'
            },
            levelScore: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: true,
                comment: 'Điểm đánh giá theo level - để so sánh với chuẩn level'
            },
            overallFeedback: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Nhận xét tổng quan từ AI - bằng ngôn ngữ đã chọn'
            },
            improvementSuggestions: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Gợi ý cải thiện - bằng ngôn ngữ đã chọn'
            },
            isForPractice: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Đánh dấu đây là phỏng vấn luyện tập, không ảnh hưởng tuyển dụng'
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
        await queryInterface.addIndex('VirtualInterview', ['userId']);
        await queryInterface.addIndex('VirtualInterview', ['status']);
        await queryInterface.addIndex('VirtualInterview', ['userId', 'createdAt']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('VirtualInterview');
    }
};

