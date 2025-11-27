'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('GradingLog', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            Phuongphap: {
                type: Sequelize.ENUM('nlp', 'ai', 'manual', 'hybrid'),
                comment: 'Phương pháp chấm'
            },
            Diemcu: {
                type: Sequelize.FLOAT,
                comment: 'Điểm cũ (trước khi chấm lại)'
            },
            Diemmoi: {
                type: Sequelize.FLOAT,
                comment: 'Điểm mới (sau khi chấm)'
            },
            Lydocham: {
                type: Sequelize.TEXT,
                comment: 'Lý do chấm lại'
            },
            Thoigiancham: {
                type: Sequelize.FLOAT,
                comment: 'Thời gian xử lý (giây)'
            },
            Nguoicham: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'User',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'ID người chấm (NULL nếu tự động)'
            },
            testAnswerId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'TestAnswer',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'ID câu trả lời'
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
        await queryInterface.addIndex('GradingLog', ['testAnswerId'], {
            name: 'idx_gradinglog_answer'
        });
        await queryInterface.addIndex('GradingLog', ['Nguoicham'], {
            name: 'idx_gradinglog_grader'
        });
        await queryInterface.addIndex('GradingLog', ['Phuongphap'], {
            name: 'idx_gradinglog_method'
        });
        await queryInterface.addIndex('GradingLog', ['createdAt'], {
            name: 'idx_gradinglog_created'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('GradingLog');
    }
};

