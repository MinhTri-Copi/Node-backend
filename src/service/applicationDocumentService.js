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

/**
 * Get all documents for HR with filters
 * @param {number} userId - HR user ID
 * @param {object} filters - Filter options (status, documentType, jobPostingId, page, limit, search)
 * @returns {object} Documents list with pagination
 */
const getAllDocumentsForHr = async (userId, filters = {}) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            };
        }

        // Get recruiters for this HR user
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: {
                    documents: [],
                    totalRows: 0,
                    totalPages: 0,
                    currentPage: 1
                }
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Get all job postings for these recruiters
        const jobPostings = await db.JobPosting.findAll({
            where: { recruiterId: recruiterIds },
            attributes: ['id']
        });

        if (!jobPostings || jobPostings.length === 0) {
            return {
                EM: 'Chưa có tin tuyển dụng nào!',
                EC: 3,
                DT: {
                    documents: [],
                    totalRows: 0,
                    totalPages: 0,
                    currentPage: 1
                }
            };
        }

        const jobPostingIds = jobPostings.map(jp => jp.id);

        // Get all applications for these job postings
        const applications = await db.JobApplication.findAll({
            where: { jobPostingId: jobPostingIds },
            attributes: ['id']
        });

        if (!applications || applications.length === 0) {
            return {
                EM: 'Chưa có đơn ứng tuyển nào!',
                EC: 4,
                DT: {
                    documents: [],
                    totalRows: 0,
                    totalPages: 0,
                    currentPage: 1
                }
            };
        }

        const applicationIds = applications.map(app => app.id);

        // Build where clause
        const whereClause = {
            jobApplicationId: applicationIds
        };

        // Filter by status
        if (filters.status && filters.status !== 'all') {
            whereClause.status = filters.status;
        }

        // Filter by document type
        if (filters.documentType && filters.documentType !== 'all') {
            whereClause.documentType = filters.documentType;
        }

        // Filter by job posting (through application)
        let applicationFilter = {};
        if (filters.jobPostingId && filters.jobPostingId !== 'all') {
            applicationFilter.jobPostingId = parseInt(filters.jobPostingId);
        }

        // Pagination
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 10;
        const offset = (page - 1) * limit;

        // Get documents with related data
        const { count, rows } = await db.ApplicationDocument.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id', 'Ngaynop'],
                    where: applicationFilter,
                    include: [
                        {
                            model: db.JobPosting,
                            attributes: ['id', 'Tieude'],
                            include: [
                                {
                                    model: db.Company,
                                    attributes: ['id', 'Tencongty']
                                }
                            ]
                        },
                        {
                            model: db.Record,
                            attributes: ['id'],
                            include: [
                                {
                                    model: db.User,
                                    attributes: ['id', 'Hoten', 'email', 'SDT']
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
            distinct: true
        });

        // Format documents
        const documents = rows.map(doc => {
            const docData = doc.toJSON();
            return {
                id: docData.id,
                documentType: docData.documentType,
                fileUrl: docData.fileUrl,
                expiryDate: docData.expiryDate,
                bankAccountNumber: docData.bankAccountNumber,
                status: docData.status,
                notes: docData.notes,
                createdAt: docData.createdAt,
                updatedAt: docData.updatedAt,
                application: {
                    id: docData.JobApplication?.id,
                    submittedDate: docData.JobApplication?.Ngaynop,
                    jobPosting: {
                        id: docData.JobApplication?.JobPosting?.id,
                        title: docData.JobApplication?.JobPosting?.Tieude,
                        company: {
                            id: docData.JobApplication?.JobPosting?.Company?.id,
                            name: docData.JobApplication?.JobPosting?.Company?.Tencongty
                        }
                    },
                    candidate: {
                        id: docData.JobApplication?.Record?.User?.id,
                        name: docData.JobApplication?.Record?.User?.Hoten,
                        email: docData.JobApplication?.Record?.User?.email,
                        phone: docData.JobApplication?.Record?.User?.SDT
                    }
                }
            };
        });

        return {
            EM: 'Lấy danh sách tài liệu thành công!',
            EC: 0,
            DT: {
                documents,
                totalRows: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page
            }
        };
    } catch (error) {
        console.error('Error in getAllDocumentsForHr:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách tài liệu!',
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
    deleteDocument,
    getAllDocumentsForHr
};

