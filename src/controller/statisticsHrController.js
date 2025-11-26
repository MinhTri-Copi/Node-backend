import statisticsHrService from '../service/statisticsHrService';

/**
 * Get dashboard statistics for HR
 */
const getDashboardStatistics = async (req, res) => {
    try {
        const userId = req.query.userId;
        const timeRange = req.query.timeRange || '6months';

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin userId!',
                EC: 1,
                DT: null
            });
        }

        const data = await statisticsHrService.getDashboardStatistics(+userId, timeRange);
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in getDashboardStatistics controller:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get application trends
 */
const getApplicationTrends = async (req, res) => {
    try {
        const userId = req.query.userId;
        const days = req.query.days || 30;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin userId!',
                EC: 1,
                DT: null
            });
        }

        const data = await statisticsHrService.getApplicationTrends(+userId, +days);
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in getApplicationTrends controller:', error);
        return res.status(500).json({
            EM: 'Có lỗi xảy ra từ server!',
            EC: -1,
            DT: null
        });
    }
};

export default {
    getDashboardStatistics,
    getApplicationTrends
};

