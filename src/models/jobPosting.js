'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class JobPosting extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            JobPosting.belongsTo(models.Company, { foreignKey: 'companyId' });
            JobPosting.belongsTo(models.Recruiter, { foreignKey: 'recruiterId' });
            JobPosting.belongsTo(models.Format, { foreignKey: 'formatId' });
            JobPosting.belongsTo(models.JobPostingStatus, { foreignKey: 'TrangthaiId' });
            JobPosting.hasMany(models.JobApplication, { foreignKey: 'jobPostingId' });
            JobPosting.hasOne(models.Test, { foreignKey: 'jobPostingId', as: 'Test' });
            JobPosting.hasMany(models.InterviewRound, { foreignKey: 'jobPostingId', as: 'InterviewRounds' });

            JobPosting.belongsToMany(models.Major, {
                through: 'MajorJobPosting',
                foreignKey: 'jobPostingId',
                otherKey: 'majorId',
            });

            JobPosting.hasOne(models.JobPostingEmbedding, {
                foreignKey: 'jobPostingId',
                as: 'Embedding'
            });

        }
    }
    JobPosting.init({
        Tieude: DataTypes.STRING(150),
        Mota: DataTypes.TEXT,
        Diadiem: DataTypes.STRING(150),


        Luongtoithieu: DataTypes.DECIMAL(12, 2),
        Luongtoida: DataTypes.DECIMAL(12, 2),

        Kinhnghiem: DataTypes.STRING(100),
        TrangthaiId: DataTypes.INTEGER,

        Ngaydang: DataTypes.DATE,          // datetime -> DataTypes.DATE
        Ngayhethan: DataTypes.DATE,        // datetime -> DataTypes.DATE

        companyId: DataTypes.INTEGER,
        recruiterId: DataTypes.INTEGER,
        formatId: DataTypes.INTEGER,
    }, {
        sequelize,
        modelName: 'JobPosting',
    });
    return JobPosting;
};
