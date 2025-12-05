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

        // Cho phép nhiều bài test cho 1 JobPosting - bỏ kiểm tra unique constraint
        // const existingTest = await db.Test.findOne({
        //     where: { jobPostingId: data.jobPostingId }
        // });

        // if (existingTest) {
        //     return {
        //         EM: 'Tin tuyển dụng này đã có bài test rồi!',
        //         EC: 5,
        //         DT: null
        //     };
        // }

        // Validate thời gian
        const now = new Date();
        
        if (data.Ngaybatdau) {
            const startDate = new Date(data.Ngaybatdau);
            if (startDate < now) {
                return {
                    EM: 'Ngày bắt đầu không được ở quá khứ!',
                    EC: 6,
                    DT: null
                };
            }
        }

        if (data.Ngayhethan) {
            const endDate = new Date(data.Ngayhethan);
            if (endDate < now) {
                return {
                    EM: 'Ngày hết hạn không được ở quá khứ!',
                    EC: 7,
                    DT: null
                };
            }
        }

        if (data.Ngaybatdau && data.Ngayhethan) {
            const startDate = new Date(data.Ngaybatdau);
            const endDate = new Date(data.Ngayhethan);
            
            // Ngày hết hạn phải sau ngày bắt đầu ít nhất 1 ngày (24 giờ)
            const oneDayInMs = 24 * 60 * 60 * 1000;
            if (endDate.getTime() - startDate.getTime() < oneDayInMs) {
                return {
                    EM: 'Ngày hết hạn phải sau ngày bắt đầu ít nhất 1 ngày!',
                    EC: 8,
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

        // Kiểm tra trạng thái test - chỉ cho phép thêm câu hỏi khi test ở trạng thái "Chưa bắt đầu"
        if (!test.Trangthai) {
            return {
                EM: 'Không thể thêm câu hỏi vào bài test không hoạt động!',
                EC: 5,
                DT: null
            };
        }

        const now = new Date();
        const startDate = test.Ngaybatdau ? new Date(test.Ngaybatdau) : null;
        const endDate = test.Ngayhethan ? new Date(test.Ngayhethan) : null;

        // Đã hết hạn
        if (endDate && now > endDate) {
            return {
                EM: 'Không thể thêm câu hỏi vào bài test đã hết hạn!',
                EC: 6,
                DT: null
            };
        }

        // Đã bắt đầu (không phải "Chưa bắt đầu")
        if (!startDate || now >= startDate) {
            return {
                EM: 'Chỉ có thể thêm câu hỏi khi bài test ở trạng thái "Chưa bắt đầu"!',
                EC: 7,
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

        // Kiểm tra trạng thái test - chỉ cho phép thêm câu hỏi khi test ở trạng thái "Chưa bắt đầu"
        if (!test.Trangthai) {
            return {
                EM: 'Không thể thêm câu hỏi vào bài test không hoạt động!',
                EC: 5,
                DT: null
            };
        }

        const now = new Date();
        const startDate = test.Ngaybatdau ? new Date(test.Ngaybatdau) : null;
        const endDate = test.Ngayhethan ? new Date(test.Ngayhethan) : null;

        // Đã hết hạn
        if (endDate && now > endDate) {
            return {
                EM: 'Không thể thêm câu hỏi vào bài test đã hết hạn!',
                EC: 6,
                DT: null
            };
        }

        // Đã bắt đầu (không phải "Chưa bắt đầu")
        if (!startDate || now >= startDate) {
            return {
                EM: 'Chỉ có thể thêm câu hỏi khi bài test ở trạng thái "Chưa bắt đầu"!',
                EC: 7,
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

/**
 * Cập nhật bài test
 * @param {number} userId - ID của HR
 * @param {number} testId - ID bài test
 * @param {object} data - Dữ liệu cập nhật
 * @returns {object} - Kết quả
 */
const updateTest = async (userId, testId, data) => {
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

        // Tìm bài test
        const test = await db.Test.findOne({
            where: { id: testId },
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                where: { recruiterId: recruiterIds }
            }]
        });

        if (!test) {
            return {
                EM: 'Không tìm thấy bài test hoặc bạn không có quyền chỉnh sửa!',
                EC: 3,
                DT: null
            };
        }

        // Kiểm tra trạng thái - chỉ cho phép chỉnh sửa test "Chưa bắt đầu"
        const now = new Date();
        const startDate = test.Ngaybatdau ? new Date(test.Ngaybatdau) : null;
        
        if (startDate && now >= startDate) {
            return {
                EM: 'Không thể chỉnh sửa bài test đã bắt đầu hoặc đang hoạt động!',
                EC: 4,
                DT: null
            };
        }

        // Validate thời gian nếu có cập nhật
        if (data.Ngaybatdau) {
            const newStartDate = new Date(data.Ngaybatdau);
            if (newStartDate < now) {
                return {
                    EM: 'Ngày bắt đầu không được ở quá khứ!',
                    EC: 5,
                    DT: null
                };
            }
        }

        if (data.Ngayhethan) {
            const newEndDate = new Date(data.Ngayhethan);
            if (newEndDate < now) {
                return {
                    EM: 'Ngày hết hạn không được ở quá khứ!',
                    EC: 6,
                    DT: null
                };
            }
        }

        if (data.Ngaybatdau && data.Ngayhethan) {
            const newStartDate = new Date(data.Ngaybatdau);
            const newEndDate = new Date(data.Ngayhethan);
            const oneDayInMs = 24 * 60 * 60 * 1000;
            
            if (newEndDate.getTime() - newStartDate.getTime() < oneDayInMs) {
                return {
                    EM: 'Ngày hết hạn phải sau ngày bắt đầu ít nhất 1 ngày!',
                    EC: 7,
                    DT: null
                };
            }
        }

        // Cập nhật bài test
        await test.update({
            Tieude: data.Tieude !== undefined ? data.Tieude : test.Tieude,
            Mota: data.Mota !== undefined ? data.Mota : test.Mota,
            Thoigiantoida: data.Thoigiantoida !== undefined ? data.Thoigiantoida : test.Thoigiantoida,
            Ngaybatdau: data.Ngaybatdau !== undefined ? data.Ngaybatdau : test.Ngaybatdau,
            Ngayhethan: data.Ngayhethan !== undefined ? data.Ngayhethan : test.Ngayhethan,
            Tongdiem: data.Tongdiem !== undefined ? data.Tongdiem : test.Tongdiem,
            Trangthai: data.Trangthai !== undefined ? data.Trangthai : test.Trangthai
        });

        return {
            EM: 'Cập nhật bài test thành công!',
            EC: 0,
            DT: test
        };

    } catch (error) {
        console.error('Error in updateTest:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật bài test!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Xóa bài test
 * @param {number} userId - ID của HR
 * @param {number} testId - ID bài test
 * @returns {object} - Kết quả
 */
const deleteTest = async (userId, testId) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        if (!userId || !testId) {
            await transaction.rollback();
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        // Kiểm tra quyền truy cập
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id'],
            transaction
        });

        if (!recruiters || recruiters.length === 0) {
            await transaction.rollback();
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: null
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Tìm bài test
        const test = await db.Test.findOne({
            where: { id: testId },
            include: [{
                model: db.JobPosting,
                as: 'JobPosting',
                where: { recruiterId: recruiterIds }
            }],
            transaction
        });

        if (!test) {
            await transaction.rollback();
            return {
                EM: 'Không tìm thấy bài test hoặc bạn không có quyền xóa!',
                EC: 3,
                DT: null
            };
        }

        // Kiểm tra trạng thái - chỉ cho phép xóa test "Chưa bắt đầu"
        if (!test.Trangthai) {
            await transaction.rollback();
            return {
                EM: 'Không thể xóa bài test không hoạt động!',
                EC: 4,
                DT: null
            };
        }

        const now = new Date();
        const startDate = test.Ngaybatdau ? new Date(test.Ngaybatdau) : null;
        const endDate = test.Ngayhethan ? new Date(test.Ngayhethan) : null;

        // Đã hết hạn
        if (endDate && now > endDate) {
            await transaction.rollback();
            return {
                EM: 'Không thể xóa bài test đã hết hạn!',
                EC: 5,
                DT: null
            };
        }

        // Đã bắt đầu (không phải "Chưa bắt đầu")
        if (!startDate || now >= startDate) {
            await transaction.rollback();
            return {
                EM: 'Chỉ có thể xóa bài test ở trạng thái "Chưa bắt đầu"!',
                EC: 6,
                DT: null
            };
        }

        // Kiểm tra xem có submission nào đã được tạo chưa
        const submissionCount = await db.TestSubmission.count({
            where: { testId },
            transaction
        });

        if (submissionCount > 0) {
            await transaction.rollback();
            return {
                EM: 'Không thể xóa bài test đã có ứng viên làm bài!',
                EC: 7,
                DT: null
            };
        }

        // Xóa tất cả câu hỏi liên quan
        await db.TestQuestion.destroy({
            where: { testId },
            transaction
        });

        // Xóa bài test
        await test.destroy({ transaction });

        await transaction.commit();

        return {
            EM: 'Xóa bài test thành công!',
            EC: 0,
            DT: { testId }
        };

    } catch (error) {
        await transaction.rollback();
        console.error('Error in deleteTest:', error);
        return {
            EM: 'Có lỗi xảy ra khi xóa bài test!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Cập nhật câu hỏi
 * @param {number} userId - ID của HR
 * @param {number} questionId - ID câu hỏi
 * @param {object} data - Dữ liệu cập nhật
 * @returns {object} - Kết quả
 */
const updateQuestion = async (userId, questionId, data) => {
    try {
        if (!userId || !questionId) {
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

        // Tìm câu hỏi và kiểm tra quyền
        const question = await db.TestQuestion.findOne({
            where: { id: questionId },
            include: [{
                model: db.Test,
                as: 'Test',
                include: [{
                    model: db.JobPosting,
                    as: 'JobPosting',
                    where: { recruiterId: recruiterIds }
                }]
            }]
        });

        if (!question) {
            return {
                EM: 'Không tìm thấy câu hỏi hoặc bạn không có quyền chỉnh sửa!',
                EC: 3,
                DT: null
            };
        }

        // Kiểm tra trạng thái test - chỉ cho phép chỉnh sửa nếu test chưa bắt đầu
        const test = question.Test;
        const now = new Date();
        const startDate = test.Ngaybatdau ? new Date(test.Ngaybatdau) : null;
        
        if (startDate && now >= startDate) {
            return {
                EM: 'Không thể chỉnh sửa câu hỏi của bài test đã bắt đầu!',
                EC: 4,
                DT: null
            };
        }

        // Validate input
        if (data.Cauhoi !== undefined && !data.Cauhoi.trim()) {
            return {
                EM: 'Câu hỏi không được để trống!',
                EC: 5,
                DT: null
            };
        }

        if (data.Dapan !== undefined && !data.Dapan.trim()) {
            return {
                EM: 'Đáp án không được để trống!',
                EC: 6,
                DT: null
            };
        }

        // Cập nhật câu hỏi
        await question.update({
            Cauhoi: data.Cauhoi !== undefined ? data.Cauhoi : question.Cauhoi,
            Dapan: data.Dapan !== undefined ? data.Dapan : question.Dapan,
            Diem: data.Diem !== undefined ? data.Diem : question.Diem,
            Loaicauhoi: data.Loaicauhoi !== undefined ? data.Loaicauhoi : question.Loaicauhoi,
            Thutu: data.Thutu !== undefined ? data.Thutu : question.Thutu
        });

        return {
            EM: 'Cập nhật câu hỏi thành công!',
            EC: 0,
            DT: question
        };

    } catch (error) {
        console.error('Error in updateQuestion:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật câu hỏi!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Xóa câu hỏi
 * @param {number} userId - ID của HR
 * @param {number} questionId - ID câu hỏi
 * @returns {object} - Kết quả
 */
const deleteQuestion = async (userId, questionId) => {
    try {
        if (!userId || !questionId) {
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

        // Tìm câu hỏi và kiểm tra quyền
        const question = await db.TestQuestion.findOne({
            where: { id: questionId },
            include: [{
                model: db.Test,
                as: 'Test',
                include: [{
                    model: db.JobPosting,
                    as: 'JobPosting',
                    where: { recruiterId: recruiterIds }
                }]
            }]
        });

        if (!question) {
            return {
                EM: 'Không tìm thấy câu hỏi hoặc bạn không có quyền xóa!',
                EC: 3,
                DT: null
            };
        }

        // Kiểm tra trạng thái test
        const test = question.Test;
        const now = new Date();
        const startDate = test.Ngaybatdau ? new Date(test.Ngaybatdau) : null;
        
        if (startDate && now >= startDate) {
            return {
                EM: 'Không thể xóa câu hỏi của bài test đã bắt đầu!',
                EC: 4,
                DT: null
            };
        }

        // Xóa câu hỏi
        await question.destroy();

        return {
            EM: 'Xóa câu hỏi thành công!',
            EC: 0,
            DT: null
        };

    } catch (error) {
        console.error('Error in deleteQuestion:', error);
        return {
            EM: 'Có lỗi xảy ra khi xóa câu hỏi!',
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
    getTestDetail,
    updateTest,
    deleteTest,
    updateQuestion,
    deleteQuestion
};

