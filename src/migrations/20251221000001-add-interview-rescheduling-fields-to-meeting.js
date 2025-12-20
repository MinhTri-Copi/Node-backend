'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add invitation_status ENUM
        await queryInterface.addColumn('Meeting', 'invitation_status', {
            type: Sequelize.ENUM('SENT', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'CANCELLED', 'COMPLETED'),
            defaultValue: 'SENT',
            allowNull: false,
            comment: 'Trạng thái phản hồi của ứng viên về lời mời phỏng vấn'
        });

        // Add rejection_count
        await queryInterface.addColumn('Meeting', 'rejection_count', {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'Số lần từ chối/đổi lịch của ứng viên'
        });

        // Add candidate_reschedule_reason
        await queryInterface.addColumn('Meeting', 'candidate_reschedule_reason', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Lý do từ chối/đổi lịch của ứng viên'
        });

        // Add interview_token
        await queryInterface.addColumn('Meeting', 'interview_token', {
            type: Sequelize.STRING(500),
            allowNull: true,
            unique: true,
            comment: 'Token định danh duy nhất cho link trong email (JWT)'
        });

        // Add index for interview_token for faster lookups
        await queryInterface.addIndex('Meeting', ['interview_token'], {
            name: 'meeting_interview_token_index',
            unique: true
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove index first
        await queryInterface.removeIndex('Meeting', 'meeting_interview_token_index');
        
        // Remove columns
        await queryInterface.removeColumn('Meeting', 'invitation_status');
        await queryInterface.removeColumn('Meeting', 'rejection_count');
        await queryInterface.removeColumn('Meeting', 'candidate_reschedule_reason');
        await queryInterface.removeColumn('Meeting', 'interview_token');
    }
};
