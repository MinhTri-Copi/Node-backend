'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('VirtualInterviewAnswer', {
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
            questionId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'VirtualInterviewQuestion',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            answerText: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'Câu trả lời của ứng viên - có thể bằng bất kỳ ngôn ngữ nào'
            },
            score: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: true,
                comment: 'Điểm sau khi chấm'
            },
            feedback: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Nhận xét từ AI cho câu này - bằng ngôn ngữ của phiên phỏng vấn'
            },
            similarityScore: {
                type: Sequelize.DECIMAL(3, 2),
                allowNull: true,
                comment: 'Độ tương đồng 0-1'
            },
            gradedAt: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Thời điểm chấm'
            },
            gradingMethod: {
                type: Sequelize.STRING(50),
                allowNull: true,
                comment: 'ai, nlp-fallback'
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
        await queryInterface.addIndex('VirtualInterviewAnswer', ['virtualInterviewId']);
        await queryInterface.addIndex('VirtualInterviewAnswer', ['questionId']);
        await queryInterface.addIndex('VirtualInterviewAnswer', ['virtualInterviewId', 'questionId'], {
            unique: true,
            name: 'unique_interview_question_answer'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('VirtualInterviewAnswer');
    }
};

