'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('testviolationlog', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            testSubmissionId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'testsubmission',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'user',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            violation_type: {
                type: Sequelize.STRING(50),
                allowNull: false,
                comment: 'Loại vi phạm: tab-switch, fullscreen-exit, blur, devtools, copy, paste, select'
            },
            message: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Mô tả chi tiết vi phạm'
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
        });

        // Add index for faster queries
        await queryInterface.addIndex('testviolationlog', ['testSubmissionId']);
        await queryInterface.addIndex('testviolationlog', ['userId']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('testviolationlog');
    }
};

