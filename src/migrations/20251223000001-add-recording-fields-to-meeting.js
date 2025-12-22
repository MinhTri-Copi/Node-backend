'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Thêm các field liên quan đến recording
        await queryInterface.addColumn('Meeting', 'recordingUrl', {
            type: Sequelize.STRING(500),
            allowNull: true,
            comment: 'URL recording từ Jitsi (sau khi meeting kết thúc)'
        });

        await queryInterface.addColumn('Meeting', 'recordingStatus', {
            type: Sequelize.ENUM('not_started', 'recording', 'processing', 'ready', 'failed'),
            defaultValue: 'not_started',
            allowNull: false,
            comment: 'Trạng thái recording: not_started/recording/processing/ready/failed'
        });

        await queryInterface.addColumn('Meeting', 'recordingStartedAt', {
            type: Sequelize.DATE,
            allowNull: true,
            comment: 'Thời gian bắt đầu recording'
        });

        await queryInterface.addColumn('Meeting', 'recordingFinishedAt', {
            type: Sequelize.DATE,
            allowNull: true,
            comment: 'Thời gian kết thúc recording'
        });
    },

    async down(queryInterface, Sequelize) {
        // Xóa các field đã thêm
        await queryInterface.removeColumn('Meeting', 'recordingUrl');
        await queryInterface.removeColumn('Meeting', 'recordingStatus');
        await queryInterface.removeColumn('Meeting', 'recordingStartedAt');
        await queryInterface.removeColumn('Meeting', 'recordingFinishedAt');
        
        // Xóa ENUM type nếu cần (Sequelize tự động xử lý)
    }
};

