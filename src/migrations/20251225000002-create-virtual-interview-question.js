'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('VirtualInterviewQuestion', {
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
            questionText: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'Câu hỏi bằng ngôn ngữ đã chọn - không dịch tự động'
            },
            topic: {
                type: Sequelize.STRING(100),
                allowNull: false,
                comment: 'VD: Java, React'
            },
            level: {
                type: Sequelize.ENUM('intern', 'junior', 'middle', 'senior'),
                allowNull: false,
                comment: 'Level của câu hỏi này'
            },
            language: {
                type: Sequelize.ENUM('vi', 'en'),
                allowNull: false,
                comment: 'Ngôn ngữ của câu hỏi - lấy từ VirtualInterview'
            },
            questionOrder: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'Thứ tự câu hỏi: 1, 2, 3...'
            },
            maxScore: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 10
            },
            difficulty: {
                type: Sequelize.ENUM('easy', 'medium', 'hard'),
                allowNull: false,
                defaultValue: 'medium',
                comment: 'Được map từ level'
            },
            questionType: {
                type: Sequelize.ENUM('concept', 'application', 'optimization', 'design'),
                allowNull: false,
                defaultValue: 'application',
                comment: 'Loại câu hỏi theo level'
            },
            metadata: {
                type: Sequelize.JSON,
                allowNull: true,
                comment: 'Lưu thêm thông tin: prompt dùng để sinh, model version, expectedAnswer...'
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
        await queryInterface.addIndex('VirtualInterviewQuestion', ['virtualInterviewId']);
        await queryInterface.addIndex('VirtualInterviewQuestion', ['virtualInterviewId', 'questionOrder']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('VirtualInterviewQuestion');
    }
};

