'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('VirtualInterviewConversation', {
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
            role: {
                type: Sequelize.ENUM('user', 'assistant', 'system'),
                allowNull: false,
                comment: 'user = candidate, assistant = AI HR'
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'Text content of the message'
            },
            messageOrder: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'Order of message in conversation'
            },
            audioUrl: {
                type: Sequelize.STRING(500),
                allowNull: true,
                comment: 'URL to audio file if available'
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

        // Add indexes with explicit names to avoid MySQL 64-character limit
        await queryInterface.addIndex('VirtualInterviewConversation', ['virtualInterviewId'], {
            name: 'idx_vi_conv_vi_id'
        });
        await queryInterface.addIndex('VirtualInterviewConversation', ['virtualInterviewId', 'messageOrder'], {
            name: 'idx_vi_conv_vi_id_msg_order'
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove indexes before dropping table
        await queryInterface.removeIndex('VirtualInterviewConversation', 'idx_vi_conv_vi_id');
        await queryInterface.removeIndex('VirtualInterviewConversation', 'idx_vi_conv_vi_id_msg_order');
        await queryInterface.dropTable('VirtualInterviewConversation');
    }
};

