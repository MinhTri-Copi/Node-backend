/**
 * CV Matching Controller
 * API endpoints cho tính năng tìm công việc phù hợp với CV
 */

import { findMatchingJobs, getJobPostingWithMatchScore } from '../service/cvMatchingService.js';

/**
 * POST /api/candidate/find-matching-jobs
 * Tìm công việc phù hợp với CV của user
 * 
 * Body: {
 *   filters: {
 *     location: string (optional),
 *     minSalary: number (optional),
 *     maxSalary: number (optional),
 *     majorId: number (optional),
 *     experience: string (optional)
 *   }
 * }
 */
const findMatchingJobsForCandidate = async (req, res) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                EM: 'Chưa đăng nhập!',
                EC: 1,
                DT: ''
            });
        }

        const filters = req.body.filters || {};

        const result = await findMatchingJobs(userId, filters);

        if (result.EC !== 0) {
            return res.status(400).json({
                EM: result.EM,
                EC: result.EC,
                DT: result.DT
            });
        }

        return res.status(200).json({
            EM: result.EM,
            EC: 0,
            DT: result.DT
        });
    } catch (error) {
        console.error('Error in findMatchingJobsForCandidate:', error);
        return res.status(500).json({
            EM: 'Lỗi khi tìm công việc phù hợp!',
            EC: -1,
            DT: ''
        });
    }
};

/**
 * GET /api/candidate/job/:id/match-score
 * Lấy match score của một job posting với CV của user
 */
const getJobMatchScore = async (req, res) => {
    try {
        const userId = req.user?.id;
        const jobPostingId = parseInt(req.params.id);

        if (!userId) {
            return res.status(401).json({
                EM: 'Chưa đăng nhập!',
                EC: 1,
                DT: ''
            });
        }

        if (!jobPostingId || isNaN(jobPostingId)) {
            return res.status(400).json({
                EM: 'ID công việc không hợp lệ!',
                EC: 1,
                DT: ''
            });
        }

        const result = await getJobPostingWithMatchScore(jobPostingId, userId);

        if (result.EC !== 0) {
            return res.status(400).json({
                EM: result.EM,
                EC: result.EC,
                DT: result.DT
            });
        }

        return res.status(200).json({
            EM: result.EM,
            EC: 0,
            DT: result.DT
        });
    } catch (error) {
        console.error('Error in getJobMatchScore:', error);
        return res.status(500).json({
            EM: 'Lỗi khi lấy match score!',
            EC: -1,
            DT: ''
        });
    }
};

export default {
    findMatchingJobsForCandidate,
    getJobMatchScore
};

