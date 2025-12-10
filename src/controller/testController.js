import testService from '../service/testService';

/**
 * Tạo bài test mới
 */
const createTest = async (req, res) => {
    try {
        const { userId } = req.query;
        const data = req.body;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const result = await testService.createTest(userId, data);

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });

    } catch (error) {
        console.error('Error in createTest controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Thêm câu hỏi vào bài test
 */
const addQuestion = async (req, res) => {
    try {
        const { userId, testId } = req.query;
        const questionData = req.body;

        if (!userId || !testId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const result = await testService.addQuestion(
            parseInt(userId), 
            parseInt(testId), 
            questionData
        );

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });

    } catch (error) {
        console.error('Error in addQuestion controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Thêm nhiều câu hỏi cùng lúc
 */
const addMultipleQuestions = async (req, res) => {
    try {
        const { userId, testId } = req.query;
        const { questions } = req.body;

        if (!userId || !testId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const result = await testService.addMultipleQuestions(
            parseInt(userId), 
            parseInt(testId), 
            questions
        );

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });

    } catch (error) {
        console.error('Error in addMultipleQuestions controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Lấy danh sách bài test của HR
 */
const getMyTests = async (req, res) => {
    try {
        const { userId, page = 1, limit = 10, jobPostingId } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const result = await testService.getMyTests(
            parseInt(userId), 
            parseInt(page), 
            parseInt(limit),
            jobPostingId ? parseInt(jobPostingId) : null
        );

        return res.status(200).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });

    } catch (error) {
        console.error('Error in getMyTests controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Lấy chi tiết bài test
 */
const getTestDetail = async (req, res) => {
    try {
        const { userId, testId } = req.query;

        if (!userId || !testId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const result = await testService.getTestDetail(
            parseInt(userId), 
            parseInt(testId)
        );

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });

    } catch (error) {
        console.error('Error in getTestDetail controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Cập nhật bài test
 */
const updateTest = async (req, res) => {
    try {
        const { userId } = req.query;
        const { testId } = req.params;
        const data = req.body;

        if (!userId || !testId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const result = await testService.updateTest(
            parseInt(userId), 
            parseInt(testId), 
            data
        );

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });

    } catch (error) {
        console.error('Error in updateTest controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Xóa bài test
 */
const deleteTest = async (req, res) => {
    try {
        const { userId } = req.query;
        const { testId } = req.params;

        if (!userId || !testId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const result = await testService.deleteTest(
            parseInt(userId),
            parseInt(testId)
        );

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });

    } catch (error) {
        console.error('Error in deleteTest controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Cập nhật câu hỏi
 */
const updateQuestion = async (req, res) => {
    try {
        const { userId } = req.query;
        const { questionId } = req.params;
        const data = req.body;

        if (!userId || !questionId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const result = await testService.updateQuestion(
            parseInt(userId), 
            parseInt(questionId), 
            data
        );

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });

    } catch (error) {
        console.error('Error in updateQuestion controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Xóa câu hỏi
 */
const deleteQuestion = async (req, res) => {
    try {
        const { userId } = req.query;
        const { questionId } = req.params;

        if (!userId || !questionId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            });
        }

        const result = await testService.deleteQuestion(
            parseInt(userId), 
            parseInt(questionId)
        );

        return res.status(result.EC === 0 ? 200 : 400).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });

    } catch (error) {
        console.error('Error in deleteQuestion controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

export default {
    createTest,
    addQuestion,
    addMultipleQuestions,
    getMyTests,
    getTestDetail,
    updateTest,
    deleteTest,
    updateQuestion,
    deleteQuestion
};

