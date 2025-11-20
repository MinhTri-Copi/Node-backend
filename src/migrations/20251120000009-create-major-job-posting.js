'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('MajorJobPosting', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            majorId: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'Major',
                    key: 'id'
                },
                allowNull: false
            },
            jobPostingId: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'JobPosting',
                    key: 'id'
                },
                allowNull: false,

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
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('MajorJobPosting');
    }
};
