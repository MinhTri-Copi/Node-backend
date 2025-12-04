'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('QuestionBankItem', {
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
                comment: 'Đáp án chuẩn'
            },
            Chude: {
                type: Sequelize.STRING(100),
                comment: 'Chủ đề câu hỏi (do LLM phân loại): OOP, Collections, Exception, etc.'
            },
            Loaicauhoi: {
                type: Sequelize.ENUM('tuluan', 'tracnghiem'),
                defaultValue: 'tuluan',
                comment: 'Loại câu hỏi: tự luận hoặc trắc nghiệm'
            },
            Diem: {
                type: Sequelize.INTEGER,
                defaultValue: 10,
                comment: 'Điểm mặc định của câu hỏi'
            },
            Dodai: {
                type: Sequelize.ENUM('ngan', 'trungbinh', 'dai'),
                defaultValue: 'trungbinh',
                comment: 'Độ dài câu hỏi: ngắn, trung bình, dài'
            },
            Dokho: {
                type: Sequelize.ENUM('de', 'trungbinh', 'kho'),
                defaultValue: 'trungbinh',
                comment: 'Độ khó: dễ, trung bình, khó'
            },
            Metadata: {
                type: Sequelize.JSON,
                comment: 'Metadata bổ sung: keywords, tags, etc.'
            },
            questionBankId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'QuestionBank',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'ID bộ đề'
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
        await queryInterface.addIndex('QuestionBankItem', ['questionBankId'], {
            name: 'idx_questionbankitem_bank'
        });
        await queryInterface.addIndex('QuestionBankItem', ['Chude'], {
            name: 'idx_questionbankitem_topic'
        });
        await queryInterface.addIndex('QuestionBankItem', ['Loaicauhoi'], {
            name: 'idx_questionbankitem_type'
        });
        await queryInterface.addIndex('QuestionBankItem', ['Dokho'], {
            name: 'idx_questionbankitem_difficulty'
        });
        // Composite index for filtering
        await queryInterface.addIndex('QuestionBankItem', ['questionBankId', 'Chude', 'Loaicauhoi'], {
            name: 'idx_questionbankitem_filter'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('QuestionBankItem');
    }
};

