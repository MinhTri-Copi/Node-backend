/**
 * CV Review Controller
 * Controller để xử lý request review CV
 */

import db from '../models/index.js';
import { reviewCV } from '../service/cvReviewService.js';

/**
 * POST /api/candidate/review-cv
 * Review CV với AI dựa trên CV standards và JD
 */
const reviewCVController = async (req, res) => {
    try {
        const { recordId, jdTexts } = req.body;
        const userId = req.user?.id;

        // Validate input
        if (!recordId) {
            return res.status(400).json({
                EM: 'Thiếu recordId!',
                EC: 1,
                DT: ''
            });
        }

        if (!jdTexts || !Array.isArray(jdTexts) || jdTexts.length === 0) {
            return res.status(400).json({
                EM: 'Cần ít nhất 1 JD (Job Description)!',
                EC: 1,
                DT: ''
            });
        }

        if (jdTexts.length > 5) {
            return res.status(400).json({
                EM: 'Tối đa 5 JD được phép!',
                EC: 1,
                DT: ''
            });
        }

        // Validate JD texts
        const validJdTexts = jdTexts.filter(jd => jd && typeof jd === 'string' && jd.trim().length > 0);
        if (validJdTexts.length === 0) {
            return res.status(400).json({
                EM: 'JD không được để trống!',
                EC: 1,
                DT: ''
            });
        }

        // Get Record (CV) from database
        const record = await db.Record.findOne({
            where: {
                id: recordId,
                userId: userId // Ensure user owns this record
            }
        });

        if (!record) {
            return res.status(404).json({
                EM: 'Không tìm thấy CV!',
                EC: 1,
                DT: ''
            });
        }

        // Check if CV text is available
        if (!record.cvText || record.cvText.trim().length === 0) {
            return res.status(400).json({
                EM: 'CV chưa được extract text! Vui lòng đợi hoặc upload lại CV.',
                EC: 1,
                DT: ''
            });
        }

        // Check extraction status
        if (record.extractionStatus !== 'READY') {
            return res.status(400).json({
                EM: `CV đang được xử lý (Status: ${record.extractionStatus}). Vui lòng đợi!`,
                EC: 1,
                DT: {
                    extractionStatus: record.extractionStatus
                }
            });
        }

        console.log(`📋 Reviewing CV for user ${userId}, record ${recordId}`);
        console.log(`   JD count: ${validJdTexts.length}`);
        console.log(`   CV text length: ${record.cvText.length} characters`);
        
        // Save full CV text to file for debugging (silent, no console log)
        const fs = require('fs');
        const path = require('path');
        const debugDir = path.join(__dirname, '..', '..', 'debug');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }
        const debugFilePath = path.join(debugDir, `cv-text-${recordId}-${Date.now()}.txt`);
        fs.writeFileSync(debugFilePath, `=== CV TEXT DEBUG ===\nRecord ID: ${recordId}\nUser ID: ${userId}\nExtracted At: ${record.extractedAt || 'N/A'}\nLength: ${record.cvText.length} characters\n\n=== CV TEXT ===\n${record.cvText}\n\n=== JD TEXTS ===\n${validJdTexts.map((jd, idx) => `\n--- JD ${idx + 1} ---\n${jd}`).join('\n')}\n`, 'utf8');

        // Call CV review service
        const result = await reviewCV(record.cvText, validJdTexts);

        if (!result.success) {
            return res.status(500).json({
                EM: result.error || 'Lỗi khi review CV!',
                EC: -1,
                DT: ''
            });
        }

        // Return review result
        return res.status(200).json({
            EM: 'Review CV thành công!',
            EC: 0,
            DT: result.data
        });

    } catch (error) {
        console.error('❌ Error in reviewCVController:', error);
        return res.status(500).json({
            EM: 'Lỗi server khi review CV!',
            EC: -1,
            DT: ''
        });
    }
};

export default {
    reviewCV: reviewCVController
};

