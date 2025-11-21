'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('JobPosting', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            Tieude: {
                type: Sequelize.STRING(150)
            },
            Mota: {
                type: Sequelize.TEXT
            },
            Diadiem: {
                type: Sequelize.STRING(150)
            },
            Luongtoithieu: {
                type: Sequelize.DECIMAL(12, 2)
            },
            Luongtoida: {
                type: Sequelize.DECIMAL(12, 2)
            },
            Kinhnghiem: {
                type: Sequelize.STRING(100)
            },
            Trangthai: {
                type: Sequelize.TINYINT
            },
            Ngaydang: {
                type: Sequelize.DATE
            },
            Ngayhethan: {
                type: Sequelize.DATE
            },
            companyId: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'Company',
                    key: 'id'
                },
                allowNull: false,
            },
            recruiterId: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'Recruiter',
                    key: 'id'
                },
                allowNull: false,

            },
            formatId: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'Format',
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
        await queryInterface.dropTable('JobPosting');
    }
};
