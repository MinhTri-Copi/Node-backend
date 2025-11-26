import db from '../models/index';
import { Op } from 'sequelize';

/**
 * Fill in missing periods (days or months) with 0 count
 * @param {Array} data - Data from database
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {boolean} usesDays - Whether to use days (true) or months (false)
 * @returns {Array} Filled data
 */
const fillMissingPeriods = (data, startDate, endDate, usesDays) => {
    const result = [];
    const dataMap = new Map(data.map(item => [item.period, parseInt(item.count)]));
    
    const current = new Date(startDate);
    
    while (current <= endDate) {
        let periodKey;
        
        if (usesDays) {
            // Format: YYYY-MM-DD
            periodKey = current.toISOString().split('T')[0];
        } else {
            // Format: YYYY-MM
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            periodKey = `${year}-${month}`;
        }
        
        result.push({
            period: periodKey,
            count: dataMap.get(periodKey) || 0
        });
        
        if (usesDays) {
            current.setDate(current.getDate() + 1);
        } else {
            current.setMonth(current.getMonth() + 1);
        }
    }
    
    return result;
};

/**
 * Get comprehensive dashboard statistics for HR
 * @param {number} userId - ID of the HR user
 * @param {string} timeRange - Time range filter (7days, 30days, 3months, 6months, 12months)
 * @returns {Object} Dashboard statistics
 */
const getDashboardStatistics = async (userId, timeRange = '6months') => {
    try {
        // Find all recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId: userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Không tìm thấy thông tin nhà tuyển dụng!',
                EC: 1,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Calculate date range based on timeRange
        const now = new Date();
        let startDate = new Date();
        let groupByFormat = '%Y-%m'; // Default: group by month
        let usesDays = false;

        switch (timeRange) {
            case '7days':
                startDate.setDate(now.getDate() - 7);
                groupByFormat = '%Y-%m-%d';
                usesDays = true;
                break;
            case '30days':
                startDate.setDate(now.getDate() - 30);
                groupByFormat = '%Y-%m-%d';
                usesDays = true;
                break;
            case '3months':
                startDate.setMonth(now.getMonth() - 3);
                groupByFormat = '%Y-%m';
                break;
            case '6months':
                startDate.setMonth(now.getMonth() - 6);
                groupByFormat = '%Y-%m';
                break;
            case '12months':
                startDate.setMonth(now.getMonth() - 12);
                groupByFormat = '%Y-%m';
                break;
            default:
                startDate.setMonth(now.getMonth() - 6);
        }

        // Get all job postings for this HR
        const allJobPostings = await db.JobPosting.findAll({
            where: { recruiterId: recruiterIds },
            attributes: ['id', 'TrangthaiId', 'createdAt', 'Ngayhethan']
        });

        const jobPostingIds = allJobPostings.map(jp => jp.id);

        // 1. Job Posting Statistics
        const totalJobs = allJobPostings.length;
        const activeJobs = allJobPostings.filter(jp => jp.TrangthaiId === 1).length;
        const inactiveJobs = allJobPostings.filter(jp => jp.TrangthaiId === 2).length;
        const expiredJobs = allJobPostings.filter(jp => {
            if (!jp.Ngayhethan) return false;
            return new Date(jp.Ngayhethan) < new Date();
        }).length;

        // 2. Application Statistics
        const totalApplications = await db.JobApplication.count({
            where: { jobPostingId: jobPostingIds }
        });

        const pendingApplications = await db.JobApplication.count({
            where: { 
                jobPostingId: jobPostingIds,
                applicationStatusId: 1 // Đang chờ
            }
        });

        const approvedApplications = await db.JobApplication.count({
            where: { 
                jobPostingId: jobPostingIds,
                applicationStatusId: 4 // Đã xét duyệt
            }
        });

        const rejectedApplications = await db.JobApplication.count({
            where: { 
                jobPostingId: jobPostingIds,
                applicationStatusId: 3 // Không đạt
            }
        });

        const interviewedApplications = await db.JobApplication.count({
            where: { 
                jobPostingId: jobPostingIds,
                applicationStatusId: 5 // Đã phỏng vấn
            }
        });

        // 3. Applications by Day/Month based on timeRange
        const applicationsByPeriod = await db.JobApplication.findAll({
            where: {
                jobPostingId: jobPostingIds,
                createdAt: {
                    [Op.gte]: startDate
                }
            },
            attributes: [
                [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('createdAt'), groupByFormat), 'period'],
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['period'],
            order: [[db.sequelize.fn('DATE_FORMAT', db.sequelize.col('createdAt'), groupByFormat), 'ASC']],
            raw: true
        });

        // Fill in missing dates/months with 0 count
        const filledData = fillMissingPeriods(applicationsByPeriod, startDate, now, usesDays);

        // 5. Top 5 Job Postings by Applications
        // Use raw query to avoid Sequelize subquery issues
        const [topJobPostingsRaw] = await db.sequelize.query(`
            SELECT 
                jp.id, 
                jp.Tieude, 
                COUNT(ja.id) as applicationCount
            FROM JobPosting jp
            LEFT JOIN JobApplication ja ON jp.id = ja.jobPostingId
            WHERE jp.recruiterId IN (${recruiterIds.join(',')})
            GROUP BY jp.id, jp.Tieude
            ORDER BY applicationCount DESC
            LIMIT 5
        `);
        
        const topJobPostings = topJobPostingsRaw.map(row => ({
            id: row.id,
            Tieude: row.Tieude,
            applicationCount: parseInt(row.applicationCount) || 0
        }));

        // 6. Application Status Distribution
        const statusDistribution = [
            { status: 'Đang chờ', count: pendingApplications, id: 1 },
            { status: 'Đã xét duyệt', count: approvedApplications, id: 4 },
            { status: 'Không đạt', count: rejectedApplications, id: 3 },
            { status: 'Đã phỏng vấn', count: interviewedApplications, id: 5 }
        ];

        // 7. Recent Applications (Last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentApplicationsCount = await db.JobApplication.count({
            where: {
                jobPostingId: jobPostingIds,
                createdAt: {
                    [Op.gte]: sevenDaysAgo
                }
            }
        });

        // 8. Conversion Rate (Approved / Total Applications)
        const conversionRate = totalApplications > 0 
            ? ((approvedApplications / totalApplications) * 100).toFixed(2)
            : 0;

        // 9. Average Applications per Job
        const avgApplicationsPerJob = totalJobs > 0
            ? (totalApplications / totalJobs).toFixed(2)
            : 0;

        return {
            EM: 'Lấy thống kê dashboard thành công!',
            EC: 0,
            DT: {
                jobPostings: {
                    total: totalJobs,
                    active: activeJobs,
                    inactive: inactiveJobs,
                    expired: expiredJobs
                },
                applications: {
                    total: totalApplications,
                    pending: pendingApplications,
                    approved: approvedApplications,
                    rejected: rejectedApplications,
                    interviewed: interviewedApplications,
                    recent: recentApplicationsCount
                },
                charts: {
                    applicationsByPeriod: filledData,
                    statusDistribution: statusDistribution,
                    topJobPostings: topJobPostings,
                    usesDays: usesDays
                },
                metrics: {
                    conversionRate: parseFloat(conversionRate),
                    avgApplicationsPerJob: parseFloat(avgApplicationsPerJob)
                }
            }
        };
    } catch (error) {
        console.error('Error in getDashboardStatistics:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy thống kê dashboard!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get application trends for the last N days
 * @param {number} userId - ID of the HR user
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {Object} Application trends data
 */
const getApplicationTrends = async (userId, days = 30) => {
    try {
        // Find all recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId: userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Không tìm thấy thông tin nhà tuyển dụng!',
                EC: 1,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Get all job postings for this HR
        const allJobPostings = await db.JobPosting.findAll({
            where: { recruiterId: recruiterIds },
            attributes: ['id']
        });

        const jobPostingIds = allJobPostings.map(jp => jp.id);

        // Get applications by day
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const applicationsByDay = await db.JobApplication.findAll({
            where: {
                jobPostingId: jobPostingIds,
                createdAt: {
                    [Op.gte]: startDate
                }
            },
            attributes: [
                [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['date'],
            order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']],
            raw: true
        });

        return {
            EM: 'Lấy xu hướng ứng tuyển thành công!',
            EC: 0,
            DT: applicationsByDay
        };
    } catch (error) {
        console.error('Error in getApplicationTrends:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy xu hướng ứng tuyển!',
            EC: -1,
            DT: null
        };
    }
};

export default {
    getDashboardStatistics,
    getApplicationTrends
};

