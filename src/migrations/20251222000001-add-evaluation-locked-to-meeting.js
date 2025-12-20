'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('Meeting', 'evaluation_locked', {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false,
            comment: 'Khóa đánh giá - không cho phép chỉnh sửa khi đã đánh giá hoặc đã duyệt ứng viên'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Meeting', 'evaluation_locked');
    }
};
