const applicationDocumentService = require('../service/applicationDocumentService');

const getDocumentsByApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user?.id || req.query.userId;

        const data = await applicationDocumentService.getDocumentsByApplication(applicationId, userId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getDocumentsByApplication controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const checkCanSubmitDocuments = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user?.id || req.query.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const canSubmit = await applicationDocumentService.hasPassedAllInterviews(applicationId);

        return res.status(200).json({
            EM: 'Kiểm tra thành công!',
            EC: 0,
            DT: {
                canSubmit: canSubmit
            }
        });
    } catch (error) {
        console.error('Error in checkCanSubmitDocuments controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const createOrUpdateDocument = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user?.id || req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const documentData = {
            documentType: req.body.documentType,
            fileUrl: req.body.fileUrl,
            expiryDate: req.body.expiryDate,
            bankAccountNumber: req.body.bankAccountNumber,
            notes: req.body.notes
        };

        const data = await applicationDocumentService.createOrUpdateDocument(applicationId, documentData, userId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in createOrUpdateDocument controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const updateDocumentStatus = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user?.id || req.body.userId;
        const { status, notes } = req.body;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const data = await applicationDocumentService.updateDocumentStatus(documentId, status, notes, userId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in updateDocumentStatus controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user?.id || req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const data = await applicationDocumentService.deleteDocument(documentId, userId);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in deleteDocument controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

const getAllDocumentsForHr = async (req, res) => {
    try {
        const userId = req.user?.id || req.query.userId;
        const { status, documentType, jobPostingId, page, limit, search } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const filters = {
            status: status || 'all',
            documentType: documentType || 'all',
            jobPostingId: jobPostingId || 'all',
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            search: search?.trim() || ''
        };

        const data = await applicationDocumentService.getAllDocumentsForHr(userId, filters);

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getAllDocumentsForHr controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

module.exports = {
    getDocumentsByApplication,
    checkCanSubmitDocuments,
    createOrUpdateDocument,
    updateDocumentStatus,
    deleteDocument,
    getAllDocumentsForHr
};

