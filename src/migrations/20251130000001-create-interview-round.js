'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('InterviewRound', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            jobPostingId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'JobPosting',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            roundNumber: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'Số vòng: 1, 2, 3...'
            },
            title: {
                type: Sequelize.STRING(100),
                allowNull: false,
                comment: 'Tên vòng phỏng vấn'
            },
            duration: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'Thời lượng phút'
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Ghi chú / nội dung vòng'
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
                comment: 'Vòng phỏng vấn có đang hoạt động không'
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

        // Thêm index cho jobPostingId và roundNumber để query nhanh hơn
        await queryInterface.addIndex('InterviewRound', ['jobPostingId']);
        await queryInterface.addIndex('InterviewRound', ['jobPostingId', 'roundNumber'], {
            unique: true,
            name: 'unique_job_round'
        });
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('InterviewRound');
    }
};

