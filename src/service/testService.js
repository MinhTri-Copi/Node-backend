import db from '../models/index';

const { Op } = db.Sequelize;

/**
 * HR tạo bài test mới cho JobPosting
 * @param {number} userId - ID của HR
 * @param {object} data - Dữ liệu bài test
 * @returns {object} - Kết quả
 */
const createTest = async (userId, data) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            };
        }

        // Validate input
        if (!data.Tieude || !data.jobPostingId) {
            return {
                EM: 'Vui lòng điền đầy đủ thông tin bắt buộc (Tiêu đề, Tin tuyển dụng)!',
                EC: 2,
                DT: null
            };
        }

        // Kiểm tra HR có quyền với JobPosting này không
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 3,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Kiểm tra JobPosting có thuộc HR này không
        const jobPosting = await db.JobPosting.findOne({
            where: {
                id: data.jobPostingId,
                recruiterId: recruiterIds
            }
        });

        if (!jobPosting) {
            return {
                EM: 'Bạn không có quyền tạo bài test cho tin tuyển dụng này!',
                EC: 4,
                DT: null
            };
        }

        // Kiểm tra đã có bài test cho JobPosting này chưa
        const existingTest = await db.Test.findOne({
            where: { jobPostingId: data.jobPostingId }
        });

        if (existingTest) {
            return {
                EM: 'Tin tuyển dụng này đã có bài test rồi!',
                EC: 5,
                DT: null
            };
        }

        // Validate thời gian
        if (data.Ngaybatdau && data.Ngayhethan) {
            const startDate = new Date(data.Ngaybatdau);
            const endDate = new Date(data.Ngayhethan);
            
            if (endDate <= startDate) {
                return {
                    EM: 'Ngày hết hạn phải sau ngày bắt đầu!',
                    EC: 6,
                    DT: null
                };
            }
        }

        // Tạo bài test
        const newTest = await db.Test.create({
            Tieude: data.Tieude,
            Mota: data.Mota || null,
            Thoigiantoida: data.Thoigiantoida || 60,
            Ngaybatdau: data.Ngaybatdau || null,
            Ngayhethan: data.Ngayhethan || null,
            Tongdiem: data.Tongdiem || 100,
            Trangthai: data.Trangthai !== undefined ? data.Trangthai : 1,
            jobPostingId: data.jobPostingId
        });

        return {
            EM: 'Tạo bài test thành công!',
            EC: 0,
            DT: newTest
        };

    } catch (error) {
        console.error('Error in createTest:', error);
        return {
            EM: 'Có lỗi xảy ra khi tạo bài test!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Thêm câu hỏi vào bài test
 * @param {number} userId - ID của HR
 * @param {number} testId - ID bài test
 * @param {object} questionData - Dữ liệu câu hỏi
 * @returns {object} - Kết quả
 */
const addQuestion = async (userId, testId, questionData) => {
    try {
        if (!userId || !testId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        // Validate input
        if (!questionData.Cauhoi || !questionData.Dapan) {
            return {
                EM: 'Vui lòng điền đầy đủ câu hỏi và đáp án!',
                EC: 2,
                DT: null
            };
        }

        // Kiểm tra quyền truy cập bài test
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 3,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Kiểm tra Test có thuộc HR này không
        const test = await db.Test.findOne({
            where: { id: testId },
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                where: { recruiterId: recruiterIds },
                attributes: ['id']
            }]
        });

        if (!test) {
            return {
                EM: 'Bạn không có quyền thêm câu hỏi vào bài test này!',
                EC: 4,
                DT: null
            };
        }

        // Lấy thứ tự câu hỏi tiếp theo
        const maxThutu = await db.TestQuestion.max('Thutu', {
            where: { testId }
        });

        const nextThutu = maxThutu ? maxThutu + 1 : 1;

        // Tạo câu hỏi
        const newQuestion = await db.TestQuestion.create({
            Cauhoi: questionData.Cauhoi,
            Dapan: questionData.Dapan,
            Loaicauhoi: questionData.Loaicauhoi || 'tuluan',
            Diem: questionData.Diem || 10,
            Thutu: questionData.Thutu || nextThutu,
            testId: testId
        });

        // Cập nhật tổng điểm của bài test
        const totalScore = await db.TestQuestion.sum('Diem', {
            where: { testId }
        });

        await test.update({ Tongdiem: totalScore || 0 });

        return {
            EM: 'Thêm câu hỏi thành công!',
            EC: 0,
            DT: newQuestion
        };

    } catch (error) {
        console.error('Error in addQuestion:', error);
        return {
            EM: 'Có lỗi xảy ra khi thêm câu hỏi!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Thêm nhiều câu hỏi cùng lúc
 * @param {number} userId - ID của HR
 * @param {number} testId - ID bài test
 * @param {array} questions - Mảng câu hỏi
 * @returns {object} - Kết quả
 */
const addMultipleQuestions = async (userId, testId, questions) => {
    try {
        if (!userId || !testId || !questions || questions.length === 0) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        // Kiểm tra quyền truy cập
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 3,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        const test = await db.Test.findOne({
            where: { id: testId },
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                where: { recruiterId: recruiterIds },
                attributes: ['id']
            }]
        });

        if (!test) {
            return {
                EM: 'Bạn không có quyền thêm câu hỏi vào bài test này!',
                EC: 4,
                DT: null
            };
        }

        // Lấy thứ tự bắt đầu
        const maxThutu = await db.TestQuestion.max('Thutu', {
            where: { testId }
        });

        let currentThutu = maxThutu ? maxThutu + 1 : 1;

        // Chuẩn bị data
        const questionsToCreate = questions.map(q => ({
            Cauhoi: q.Cauhoi,
            Dapan: q.Dapan,
            Loaicauhoi: q.Loaicauhoi || 'tuluan',
            Diem: q.Diem || 10,
            Thutu: q.Thutu || currentThutu++,
            testId: testId
        }));

        // Tạo nhiều câu hỏi
        const createdQuestions = await db.TestQuestion.bulkCreate(questionsToCreate);

        // Cập nhật tổng điểm
        const totalScore = await db.TestQuestion.sum('Diem', {
            where: { testId }
        });

        await test.update({ Tongdiem: totalScore || 0 });

        return {
            EM: `Thêm ${createdQuestions.length} câu hỏi thành công!`,
            EC: 0,
            DT: createdQuestions
        };

    } catch (error) {
        console.error('Error in addMultipleQuestions:', error);
        return {
            EM: 'Có lỗi xảy ra khi thêm câu hỏi!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Lấy danh sách bài test của HR
 * @param {number} userId - ID của HR
 * @param {number} page - Trang hiện tại
 * @param {number} limit - Số lượng mỗi trang
 * @returns {object} - Danh sách bài test
 */
const getMyTests = async (userId, page = 1, limit = 10) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            };
        }

        // Lấy recruiters của HR
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: {
                    tests: [],
                    pagination: {
                        currentPage: 1,
                        totalPages: 0,
                        totalRows: 0,
                        limit: limit
                    }
                }
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        const offset = (page - 1) * limit;

        // Đếm tổng số bài test
        const totalRows = await db.Test.count({
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                where: { recruiterId: recruiterIds },
                attributes: []
            }]
        });

        // Lấy danh sách bài test
        const tests = await db.Test.findAll({
            include: [
                {
                    model: db.JobPosting,
                    as: 'JobPosting',
                    where: { recruiterId: recruiterIds },
                    attributes: ['id', 'Tieude', 'companyId']
                },
                {
                    model: db.TestQuestion,
                    as: 'Questions',
                    attributes: ['id']
                }
            ],
            offset: offset,
            limit: limit,
            order: [['createdAt', 'DESC']],
            distinct: true
        });

        // Thêm thống kê và company info
        const testsWithStats = await Promise.all(tests.map(async (test) => {
            const questionCount = await db.TestQuestion.count({
                where: { testId: test.id }
            });

            const submissionCount = await db.TestSubmission.count({
                where: { testId: test.id }
            });

            // Lấy company info riêng
            let companyInfo = null;
            if (test.JobPosting && test.JobPosting.companyId) {
                const company = await db.Company.findOne({
                    where: { id: test.JobPosting.companyId },
                    attributes: ['id', 'Tencongty']
                });
                companyInfo = company ? company.toJSON() : null;
            }

            const testData = test.toJSON();
            
            return {
                ...testData,
                JobPosting: {
                    ...testData.JobPosting,
                    Company: companyInfo
                },
                questionCount,
                submissionCount
            };
        }));

        return {
            EM: 'Lấy danh sách bài test thành công!',
            EC: 0,
            DT: {
                tests: testsWithStats,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalRows / limit),
                    totalRows: totalRows,
                    limit: limit
                }
            }
        };

    } catch (error) {
        console.error('Error in getMyTests:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách bài test!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Lấy chi tiết bài test (bao gồm câu hỏi)
 * @param {number} userId - ID của HR
 * @param {number} testId - ID bài test
 * @returns {object} - Chi tiết bài test
 */
const getTestDetail = async (userId, testId) => {
    try {
        if (!userId || !testId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        // Kiểm tra quyền truy cập
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Lấy bài test với câu hỏi
        const test = await db.Test.findOne({
            where: { id: testId },
            include: [
                {
                    model: db.JobPosting,
                    as: 'JobPosting',
                    where: { recruiterId: recruiterIds },
                    attributes: ['id', 'Tieude', 'companyId']
                },
                {
                    model: db.TestQuestion,
                    as: 'Questions',
                    order: [['Thutu', 'ASC']]
                }
            ]
        });

        if (!test) {
            return {
                EM: 'Không tìm thấy bài test hoặc bạn không có quyền truy cập!',
                EC: 3,
                DT: null
            };
        }

        // Lấy company info riêng
        let companyInfo = null;
        if (test.JobPosting && test.JobPosting.companyId) {
            const company = await db.Company.findOne({
                where: { id: test.JobPosting.companyId },
                attributes: ['id', 'Tencongty']
            });
            companyInfo = company ? company.toJSON() : null;
        }

        // Thống kê
        const submissionCount = await db.TestSubmission.count({
            where: { testId: test.id }
        });

        const completedCount = await db.TestSubmission.count({
            where: { 
                testId: test.id,
                Trangthai: 'dacham'
            }
        });

        const testData = test.toJSON();

        return {
            EM: 'Lấy chi tiết bài test thành công!',
            EC: 0,
            DT: {
                ...testData,
                JobPosting: {
                    ...testData.JobPosting,
                    Company: companyInfo
                },
                statistics: {
                    submissionCount,
                    completedCount,
                    inProgressCount: submissionCount - completedCount
                }
            }
        };

    } catch (error) {
        console.error('Error in getTestDetail:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy chi tiết bài test!',
            EC: -1,
            DT: null
        };
    }
};

export default {
    createTest,
    addQuestion,
    addMultipleQuestions,
    getMyTests,
    getTestDetail
};

