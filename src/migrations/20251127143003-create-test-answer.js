'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('TestAnswer', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            Cautraloi: {
                type: Sequelize.TEXT,
                comment: 'Câu trả lời của ứng viên'
            },
            Diemdatduoc: {
                type: Sequelize.FLOAT,
                defaultValue: 0,
                comment: 'Điểm đạt được (do AI/NLP chấm)'
            },
            Nhanxet: {
                type: Sequelize.TEXT,
                comment: 'Nhận xét từ hệ thống hoặc HR'
            },
            Dungkhong: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                comment: 'Đúng hay sai'
            },
            Phuongphap: {
                type: Sequelize.ENUM('nlp', 'ai', 'manual', 'hybrid'),
                defaultValue: 'hybrid',
                comment: 'Phương pháp chấm bài'
            },
            Dosattinhcua_nlp: {
                type: Sequelize.FLOAT,
                comment: 'Độ tương đồng từ NLP (0-1)'
            },
            Dosattinhcua_ai: {
                type: Sequelize.FLOAT,
                comment: 'Độ tương đồng từ AI (0-1)'
            },
            testSubmissionId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'TestSubmission',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'ID bài test đã gửi'
            },
            testQuestionId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'TestQuestion',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'ID câu hỏi'
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
        await queryInterface.addIndex('TestAnswer', ['testSubmissionId'], {
            name: 'idx_testanswer_submission'
        });
        await queryInterface.addIndex('TestAnswer', ['testQuestionId'], {
            name: 'idx_testanswer_question'
        });
        await queryInterface.addIndex('TestAnswer', ['Phuongphap'], {
            name: 'idx_testanswer_method'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('TestAnswer');
    }
};

