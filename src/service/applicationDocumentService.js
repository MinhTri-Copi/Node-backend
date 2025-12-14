const db = require('../models');
const { Op } = db.Sequelize;

/**
 * Get documents for a job application
 */
const getDocumentsByApplication = async (applicationId, userId = null) => {
    try {
        if (!applicationId) {
            return {
                EM: 'Thiếu thông tin đơn ứng tuyển!',
                EC: 1,
                DT: null
            };
        }

        // Check if application exists and user has permission
        const application = await db.JobApplication.findOne({
            where: { id: applicationId },
            include: [
                {
                    model: db.Record,
                    attributes: ['id', 'userId']
                }
            ]
        });

        if (!application) {
            return {
                EM: 'Không tìm thấy đơn ứng tuyển!',
                EC: 2,
                DT: null
            };
        }

        // If userId provided, check permission (candidate can only see their own)
        if (userId && application.Record && application.Record.userId !== userId) {
            return {
                EM: 'Bạn không có quyền xem tài liệu này!',
                EC: 3,
                DT: null
            };
        }

        const documents = await db.ApplicationDocument.findAll({
            where: { jobApplicationId: applicationId },
            order: [['createdAt', 'DESC']]
        });

        return {
            EM: 'Lấy danh sách tài liệu thành công!',
            EC: 0,
            DT: documents.map(d => d.toJSON())
        };
    } catch (error) {
        console.error('Error in getDocumentsByApplication:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách tài liệu!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Check if candidate can submit documents
 * Logic: Nếu status = 2 (Đã được nhận) thì cho phép nộp tài liệu
 * Không cần kiểm tra meetings vì status = 2 đã đảm bảo ứng viên đã được nhận
 */
const hasPassedAllInterviews = async (applicationId) => {
    try {
        const application = await db.JobApplication.findOne({
            where: { id: applicationId },
            attributes: ['id', 'applicationStatusId']
        });

        if (!application) {
            return false;
        }

        // Nếu status = 2 (Đã được nhận) thì cho phép nộp tài liệu
        // Status = 2 có nghĩa là ứng viên đã được nhận, không cần kiểm tra meetings nữa
        return application.applicationStatusId === 2;
    } catch (error) {
        console.error('Error checking interview status:', error);
        return false;
    }
};

/**
 * Create or update application document
 */
const createOrUpdateDocument = async (applicationId, documentData, userId) => {
    try {
        if (!applicationId || !documentData.documentType) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        // Check if application exists and belongs to user
        const application = await db.JobApplication.findOne({
            where: { id: applicationId },
            include: [
                {
                    model: db.Record,
                    attributes: ['id', 'userId']
                }
            ]
        });

        if (!application) {
            return {
                EM: 'Không tìm thấy đơn ứng tuyển!',
                EC: 2,
                DT: null
            };
        }

        // Check if user owns this application
        if (application.Record && application.Record.userId !== userId) {
            return {
                EM: 'Bạn không có quyền thêm tài liệu cho đơn ứng tuyển này!',
                EC: 3,
                DT: null
            };
        }

        // Check if application status is "Đã được nhận" (id = 2)
        // Nếu status = 2 thì cho phép nộp tài liệu (không cần kiểm tra meetings)
        if (application.applicationStatusId !== 2) {
            return {
                EM: 'Bạn chỉ có thể nộp tài liệu khi đơn ứng tuyển đã được duyệt (Đã được nhận)!',
                EC: 4,
                DT: null
            };
        }

        // Check if document of this type already exists
        const existingDoc = await db.ApplicationDocument.findOne({
            where: {
                jobApplicationId: applicationId,
                documentType: documentData.documentType
            }
        });

        let document;
        if (existingDoc) {
            // Update existing document
            await existingDoc.update({
                fileUrl: documentData.fileUrl || existingDoc.fileUrl,
                expiryDate: documentData.expiryDate || existingDoc.expiryDate,
                bankAccountNumber: documentData.bankAccountNumber || existingDoc.bankAccountNumber,
                notes: documentData.notes || existingDoc.notes,
                status: 'pending' // Reset to pending when updated
            });
            document = existingDoc;
        } else {
            // Create new document
            document = await db.ApplicationDocument.create({
                jobApplicationId: applicationId,
                documentType: documentData.documentType,
                fileUrl: documentData.fileUrl || null,
                expiryDate: documentData.expiryDate || null,
                bankAccountNumber: documentData.bankAccountNumber || null,
                notes: documentData.notes || null,
                status: 'pending'
            });
        }

        return {
            EM: existingDoc ? 'Cập nhật tài liệu thành công!' : 'Nộp tài liệu thành công!',
            EC: 0,
            DT: document.toJSON()
        };
    } catch (error) {
        console.error('Error in createOrUpdateDocument:', error);
        return {
            EM: 'Có lỗi xảy ra khi nộp tài liệu!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Update document status (for HR)
 */
const updateDocumentStatus = async (documentId, status, notes, userId) => {
    try {
        if (!documentId || !status) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            };
        }

        const document = await db.ApplicationDocument.findOne({
            where: { id: documentId },
            include: [
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id'],
                    include: [
                        {
                            model: db.JobPosting,
                            attributes: ['id', 'recruiterId']
                        }
                    ]
                }
            ]
        });

        if (!document) {
            return {
                EM: 'Không tìm thấy tài liệu!',
                EC: 2,
                DT: null
            };
        }

        // Check if user is HR and has permission
        const recruiter = await db.Recruiter.findOne({
            where: {
                userId: userId,
                id: document.JobApplication.JobPosting.recruiterId
            }
        });

        if (!recruiter) {
            return {
                EM: 'Bạn không có quyền cập nhật tài liệu này!',
                EC: 3,
                DT: null
            };
        }

        await document.update({
            status: status,
            notes: notes || document.notes
        });

        return {
            EM: 'Cập nhật trạng thái tài liệu thành công!',
            EC: 0,
            DT: document.toJSON()
        };
    } catch (error) {
        console.error('Error in updateDocumentStatus:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật trạng thái!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Delete document
 */
const deleteDocument = async (documentId, userId) => {
    try {
        if (!documentId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const document = await db.ApplicationDocument.findOne({
            where: { id: documentId },
            include: [
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id'],
                    include: [
                        {
                            model: db.Record,
                            attributes: ['id', 'userId']
                        }
                    ]
                }
            ]
        });

        if (!document) {
            return {
                EM: 'Không tìm thấy tài liệu!',
                EC: 2,
                DT: null
            };
        }

        // Check if user owns this application
        if (document.JobApplication.Record && document.JobApplication.Record.userId !== userId) {
            return {
                EM: 'Bạn không có quyền xóa tài liệu này!',
                EC: 3,
                DT: null
            };
        }

        await document.destroy();

        return {
            EM: 'Xóa tài liệu thành công!',
            EC: 0,
            DT: null
        };
    } catch (error) {
        console.error('Error in deleteDocument:', error);
        return {
            EM: 'Có lỗi xảy ra khi xóa tài liệu!',
            EC: -1,
            DT: null
        };
    }
};

module.exports = {
    getDocumentsByApplication,
    hasPassedAllInterviews,
    createOrUpdateDocument,
    updateDocumentStatus,
    deleteDocument
};

