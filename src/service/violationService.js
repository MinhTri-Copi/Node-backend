import db from '../models/index';

/**
 * Log a violation during test taking
 */
const logViolation = async (data) => {
    try {
        const { testSubmissionId, userId, violation_type, message } = data;

        if (!testSubmissionId || !userId || !violation_type) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        // Verify submission exists and belongs to user
        const submission = await db.TestSubmission.findOne({
            where: { id: testSubmissionId, userId }
        });

        if (!submission) {
            return {
                EM: 'Không tìm thấy bài test!',
                EC: 2,
                DT: null
            };
        }

        // Only log violations for tests that are still in progress
        if (submission.Trangthai !== 'danglam') {
            return {
                EM: 'Bài test đã kết thúc, không ghi nhận vi phạm!',
                EC: 3,
                DT: null
            };
        }

        // Create violation log
        const violation = await db.TestViolationLog.create({
            testSubmissionId,
            userId,
            violation_type,
            message: message || null
        });

        // Count total violations for this submission
        const violationCount = await db.TestViolationLog.count({
            where: { testSubmissionId }
        });

        return {
            EM: 'Đã ghi nhận vi phạm!',
            EC: 0,
            DT: {
                violation,
                totalViolations: violationCount
            }
        };

    } catch (error) {
        console.error('Error in logViolation:', error);
        return {
            EM: 'Lỗi khi ghi nhận vi phạm!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get violation count for a submission
 */
const getViolationCount = async (testSubmissionId, userId) => {
    try {
        if (!testSubmissionId || !userId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const count = await db.TestViolationLog.count({
            where: { testSubmissionId, userId }
        });

        return {
            EM: 'Lấy số lần vi phạm thành công!',
            EC: 0,
            DT: { count }
        };

    } catch (error) {
        console.error('Error in getViolationCount:', error);
        return {
            EM: 'Lỗi khi lấy số lần vi phạm!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get all violations for a submission (for HR review)
 */
const getViolationsForSubmission = async (testSubmissionId) => {
    try {
        if (!testSubmissionId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const violations = await db.TestViolationLog.findAll({
            where: { testSubmissionId },
            include: [{
                model: db.User,
                as: 'User',
                attributes: ['id', 'Hoten', 'email']
            }],
            order: [['createdAt', 'ASC']]
        });

        return {
            EM: 'Lấy danh sách vi phạm thành công!',
            EC: 0,
            DT: violations
        };

    } catch (error) {
        console.error('Error in getViolationsForSubmission:', error);
        return {
            EM: 'Lỗi khi lấy danh sách vi phạm!',
            EC: -1,
            DT: null
        };
    }
};

export default {
    logViolation,
    getViolationCount,
    getViolationsForSubmission
};

