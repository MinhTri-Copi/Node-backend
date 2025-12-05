import violationService from '../service/violationService';

/**
 * Log a violation
 */
const logViolation = async (req, res) => {
    try {
        const { testSubmissionId, userId, violation_type, message } = req.body;

        const data = await violationService.logViolation({
            testSubmissionId,
            userId,
            violation_type,
            message
        });

        return res.status(200).json(data);

    } catch (error) {
        console.error('Error in logViolation controller:', error);
        return res.status(500).json({
            EM: 'Lỗi server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get violation count for a submission
 */
const getViolationCount = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { userId } = req.query;

        const data = await violationService.getViolationCount(
            parseInt(submissionId),
            parseInt(userId)
        );

        return res.status(200).json(data);

    } catch (error) {
        console.error('Error in getViolationCount controller:', error);
        return res.status(500).json({
            EM: 'Lỗi server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get all violations for a submission (HR view)
 */
const getViolationsForSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;

        const data = await violationService.getViolationsForSubmission(
            parseInt(submissionId)
        );

        return res.status(200).json(data);

    } catch (error) {
        console.error('Error in getViolationsForSubmission controller:', error);
        return res.status(500).json({
            EM: 'Lỗi server!',
            EC: -1,
            DT: null
        });
    }
};

export default {
    logViolation,
    getViolationCount,
    getViolationsForSubmission
};

