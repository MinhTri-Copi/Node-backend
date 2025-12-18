import recordService from '../service/recordService';
import { getCVExtractionStatus } from '../service/cvExtractionService.js';

// Get all records of logged-in user
const getMyRecords = async (req, res) => {
    try {
        // Get userId from request body/query (trong thực tế sẽ lấy từ JWT token)
        let userId = req.query.userId || req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin user!',
                EC: 1,
                DT: ''
            });
        }

        let data = await recordService.getRecordsByUserId(userId);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Get record by ID
const getRecordById = async (req, res) => {
    try {
        let id = req.params.id;
        let userId = req.query.userId || req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin user!',
                EC: 1,
                DT: ''
            });
        }

        let data = await recordService.getRecordById(id, userId);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Create new record
const createRecord = async (req, res) => {
    try {
        let data = await recordService.createRecord(req.body);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Update record
const updateRecord = async (req, res) => {
    try {
        let id = req.params.id;
        let userId = req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin user!',
                EC: 1,
                DT: ''
            });
        }

        let data = await recordService.updateRecord(id, userId, req.body);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Delete record
const deleteRecord = async (req, res) => {
    try {
        let id = req.params.id;
        let userId = req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin user!',
                EC: 1,
                DT: ''
            });
        }

        let data = await recordService.deleteRecord(id, userId);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Upload CV file
const uploadCV = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                EM: 'Vui lòng chọn file!',
                EC: 1,
                DT: ''
            });
        }

        const userId = req.body.userId || req.user?.id;
        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            });
        }

        // Import CV extraction service
        const { createOrUpdateCandidateCV, processCVExtraction } = await import('../service/cvExtractionService.js');
        const fs = await import('fs');
        const path = await import('path');

        // Get absolute file path
        const uploadDir = path.resolve(__dirname, '..', 'public', 'uploads', 'cv');
        const absoluteFilePath = path.join(uploadDir, req.file.filename);
        const filePath = `/uploads/cv/${req.file.filename}`;

        // Read file buffer để tính hash
        const fileBuffer = fs.readFileSync(absoluteFilePath);

        // Tạo hoặc cập nhật CandidateCV record
        const result = await createOrUpdateCandidateCV(userId, absoluteFilePath, fileBuffer);

        if (result.EC !== 0) {
            return res.status(500).json({
                EM: result.EM,
                EC: result.EC,
                DT: ''
            });
        }

        const record = result.DT;

        // Nếu CV đã được extract trước đó → return ngay
        if (record.extractionStatus === 'READY' && record.cvText) {
            return res.status(200).json({
                EM: 'Upload file thành công! CV đã được xử lý trước đó.',
                EC: 0,
                DT: {
                    fileName: req.file.filename,
                    filePath: filePath,
                    fileUrl: `http://localhost:8082${filePath}`,
                    extractionStatus: 'READY',
                    recordId: record.id
                }
            });
        }

        // Background job: Process CV extraction (không block response)
        // Dùng setTimeout để chạy async, không block request
        setTimeout(async () => {
            try {
                await processCVExtraction(record.id);
            } catch (error) {
                console.error('Error in background CV extraction:', error);
            }
        }, 100); // Delay 100ms để đảm bảo response đã được gửi

        return res.status(200).json({
            EM: 'Upload file thành công! Đang xử lý CV...',
            EC: 0,
                DT: {
                    fileName: req.file.filename,
                    filePath: filePath,
                    fileUrl: `http://localhost:8082${filePath}`,
                    extractionStatus: 'PENDING',
                    recordId: record.id
                }
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi khi upload file!',
            EC: -1,
            DT: ''
        });
    }
};

/**
 * GET /api/candidate/cv-status
 * Get CV extraction status của user
 */
const getCVStatus = async (req, res) => {
    try {
        const userId = req.user?.id || req.query.userId || req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin user!',
                EC: 1,
                DT: null
            });
        }

        const result = await getCVExtractionStatus(userId);

        return res.status(200).json({
            EM: result.EM,
            EC: result.EC,
            DT: result.DT
        });
    } catch (error) {
        console.error('Error getting CV status:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

module.exports = {
    getMyRecords,
    getRecordById,
    createRecord,
    updateRecord,
    deleteRecord,
    uploadCV,
    getCVStatus
};

