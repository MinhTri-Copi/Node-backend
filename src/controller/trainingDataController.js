/**
 * TRAINING DATA CONTROLLER
 * 
 * API endpoints để quản lý dữ liệu training
 */

const trainingDataService = require('../service/trainingDataService');
const trainingDataGradingService = require('../service/trainingDataGradingService');
const cvMatchingDataGenerationService = require('../service/cvMatchingDataGenerationService');
const path = require('path');
const fs = require('fs').promises;

/**
 * GET /api/hr/training-data/questions
 * Lấy tất cả câu hỏi tự luận
 */
const getEssayQuestions = async (req, res) => {
    try {
        const questions = await trainingDataService.getAllEssayQuestions();
        res.json({
            success: true,
            data: questions,
            total: questions.length
        });
    } catch (error) {
        console.error('Error getting essay questions:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách câu hỏi',
            error: error.message
        });
    }
};

/**
 * GET /api/hr/training-data/answers
 * Lấy tất cả câu trả lời đã chấm
 */
const getGradedAnswers = async (req, res) => {
    try {
        const answers = await trainingDataService.getAllGradedAnswers();
        res.json({
            success: true,
            data: answers,
            total: answers.length
        });
    } catch (error) {
        console.error('Error getting graded answers:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách câu trả lời',
            error: error.message
        });
    }
};

/**
 * POST /api/hr/training-data/dataset
 * Tạo dataset training với các filter
 */
const createDataset = async (req, res) => {
    try {
        const options = {
            minAnswersPerQuestion: parseInt(req.body.minAnswersPerQuestion) || 1,
            includeOnlyManualGraded: req.body.includeOnlyManualGraded === true,
            includeOnlyAIGraded: req.body.includeOnlyAIGraded === true,
            minSimilarity: parseFloat(req.body.minSimilarity) || 0,
            maxSimilarity: parseFloat(req.body.maxSimilarity) || 1
        };

        const dataset = await trainingDataService.createTrainingDataset(options);
        
        res.json({
            success: true,
            data: dataset
        });
    } catch (error) {
        console.error('Error creating dataset:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo dataset',
            error: error.message
        });
    }
};

/**
 * POST /api/hr/training-data/export
 * Export dataset ra file JSON
 */
const exportDataset = async (req, res) => {
    try {
        const options = {
            minAnswersPerQuestion: parseInt(req.body.minAnswersPerQuestion) || 1,
            includeOnlyManualGraded: req.body.includeOnlyManualGraded === true,
            includeOnlyAIGraded: req.body.includeOnlyAIGraded === true,
            minSimilarity: parseFloat(req.body.minSimilarity) || 0,
            maxSimilarity: parseFloat(req.body.maxSimilarity) || 1
        };

        // Tạo thư mục exports nếu chưa có
        const fsSync = require('fs');
        const exportsDir = path.join(__dirname, '../../exports');
        if (!fsSync.existsSync(exportsDir)) {
            await fs.mkdir(exportsDir, { recursive: true });
        }

        const filename = `training_dataset_${Date.now()}.json`;
        const outputPath = path.join(exportsDir, filename);

        const fullPath = await trainingDataService.exportTrainingDataset(outputPath, options);
        
        // Trả về file
        res.download(fullPath, filename, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(500).json({
                    success: false,
                    message: 'Lỗi khi tải file',
                    error: err.message
                });
            }
        });
    } catch (error) {
        console.error('Error exporting dataset:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi export dataset',
            error: error.message
        });
    }
};

/**
 * GET /api/debug/export-answers
 * PHA B - Bước B1: Export dữ liệu ra JSON để chuyển sang CSV
 * Format: questionId, questionText, correctAnswer, studentAnswer, maxScore, teacherScore
 */
const exportAnswersForTraining = async (req, res) => {
    try {
        console.log('🔄 Đang export dữ liệu cho CSV...');
        const data = await trainingDataService.exportAnswersForCSV();
        
        console.log(`✅ Export thành công: ${data.length} dòng`);
        
        res.json({
            success: true,
            data: data,
            total: data.length,
            message: `Đã export ${data.length} dòng dữ liệu. Dùng script convert-to-csv.js để chuyển sang CSV.`
        });
    } catch (error) {
        console.error('❌ Error exporting answers for training:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi export dữ liệu',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * GET /api/debug/answers-needing-grading
 * PHA B - Bước B2: Lấy danh sách câu trả lời cần chấm
 */
const getAnswersNeedingGrading = async (req, res) => {
    try {
        const options = {
            includeAlreadyGraded: req.query.includeAlreadyGraded === 'true',
            minAnswers: parseInt(req.query.minAnswers) || 0
        };
        
        const answers = await trainingDataGradingService.getAnswersNeedingGrading(options);
        
        res.json({
            success: true,
            data: answers,
            total: answers.length
        });
    } catch (error) {
        console.error('Error getting answers needing grading:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách câu cần chấm',
            error: error.message
        });
    }
};

/**
 * POST /api/debug/grade-with-llm
 * PHA B - Bước B2: Dùng LLM chấm các câu trả lời
 * 
 * Request body: { items: [{ questionId, questionText, correctAnswer, candidateAnswer, maxScore }] }
 */
const gradeWithLLM = async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cần cung cấp mảng items'
            });
        }

        console.log(`🔄 Đang chấm ${items.length} câu bằng LLM...`);
        const results = await trainingDataGradingService.gradeAnswersBatchWithLLM(items);
        
        res.json({
            success: true,
            data: results,
            total: results.length,
            message: `Đã chấm ${results.length} câu bằng LLM`
        });
    } catch (error) {
        console.error('Error grading with LLM:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi chấm bằng LLM',
            error: error.message
        });
    }
};

/**
 * POST /api/hr/cv-matching/generate-training-data
 * Sinh dữ liệu training CV-JD matching bằng LLM
 * Body: { targetCount: 5, autoMerge: true }
 */
const generateCVMatchingTrainingData = async (req, res) => {
    try {
        const body = req.body || {};
        const { targetCount = 5, autoMerge = true } = body;

        if (!targetCount || targetCount < 1) {
            return res.status(400).json({
                success: false,
                message: 'targetCount phải >= 1'
            });
        }

        // Chạy generation trong background (không block response)
        cvMatchingDataGenerationService.autoGenerateAndSaveTrainingData({
            targetCount,
            autoMerge
        })
            .then(result => {
                if (result.success) {
                    console.log(`✅ CV Matching Training Data: ${result.message}`);
                } else {
                    console.error(`❌ CV Matching Training Data: ${result.message}`);
                }
            })
            .catch(error => {
                console.error('❌ Lỗi khi sinh CV matching training data:', error);
            });

        // Trả response ngay
        res.json({
            success: true,
            message: `Đã bắt đầu sinh ${targetCount} CV-JD pairs. Quá trình sẽ chạy trong background.`,
            targetCount
        });
    } catch (error) {
        console.error('Error generating CV matching training data:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi sinh dữ liệu training',
            error: error.message
        });
    }
};

/**
 * GET /api/hr/cv-matching/training-data/status
 * Kiểm tra trạng thái file CSV training data
 */
const getCVMatchingTrainingDataStatus = async (req, res) => {
    try {
        // ml-grader nằm cùng cấp với backend → đi lên 3 cấp
        const csvPath = path.join(__dirname, '../../../ml-grader/cv_matching_data.csv');
        
        let rowCount = 0;
        let fileSize = 0;
        let exists = false;

        const fsSync = require('fs');
        if (fsSync.existsSync(csvPath)) {
            exists = true;
            const stats = await fsSync.promises.stat(csvPath);
            fileSize = stats.size;

            // Đếm số dòng
            const content = await fsSync.promises.readFile(csvPath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            rowCount = Math.max(0, lines.length - 1); // Trừ header
        }

        res.json({
            success: true,
            data: {
                exists,
                rowCount,
                fileSize,
                filePath: csvPath
            }
        });
    } catch (error) {
        console.error('Error getting CV matching training data status:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi kiểm tra trạng thái',
            error: error.message
        });
    }
};

module.exports = {
    getEssayQuestions,
    getGradedAnswers,
    createDataset,
    exportDataset,
    exportAnswersForTraining,
    getAnswersNeedingGrading,
    gradeWithLLM,
    generateCVMatchingTrainingData,
    getCVMatchingTrainingDataStatus
};
