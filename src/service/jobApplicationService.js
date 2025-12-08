import db from '../models/index';

const DEFAULT_STATUS_ID = 1; // Đang chờ

const getTestAccessState = (test) => {
    if (!test) return 'inactive';

    if (test.Trangthai === 0) {
        return 'inactive';
    }

    const now = new Date();
    const startDate = test.Ngaybatdau ? new Date(test.Ngaybatdau) : null;
    const endDate = test.Ngayhethan ? new Date(test.Ngayhethan) : null;

    if (startDate && now < startDate) {
        return 'pending';
    }

    if (endDate && now > endDate) {
        return 'expired';
    }

    return 'active';
};

const applyJob = async (data) => {
    try {
        const { userId, jobPostingId, recordId, coverLetter, applicantPhone } = data;

        if (!userId || !jobPostingId || !recordId) {
            return {
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: ''
            };
        }

        const user = await db.User.findByPk(userId);

        if (!user) {
            return {
                EM: 'Không tìm thấy thông tin người dùng!',
                EC: 7,
                DT: ''
            };
        }

        const job = await db.JobPosting.findOne({
            where: { id: jobPostingId }
        });

        if (!job) {
            return {
                EM: 'Không tìm thấy tin tuyển dụng!',
                EC: 2,
                DT: ''
            };
        }

        if (job.TrangthaiId && job.TrangthaiId !== 1) {
            return {
                EM: 'Tin tuyển dụng đã đóng, không thể ứng tuyển!',
                EC: 3,
                DT: ''
            };
        }

        const record = await db.Record.findOne({
            where: {
                id: recordId,
                userId: userId
            }
        });

        if (!record) {
            return {
                EM: 'Hồ sơ không hợp lệ!',
                EC: 4,
                DT: ''
            };
        }

        const existingApplication = await db.JobApplication.findOne({
            where: { jobPostingId },
            include: [{
                model: db.Record,
                where: { userId },
                attributes: [],
                required: true
            }]
        });

        if (existingApplication) {
            return {
                EM: 'Bạn đã ứng tuyển công việc này rồi!',
                EC: 5,
                DT: ''
            };
        }

        const status = await db.ApplicationStatus.findByPk(DEFAULT_STATUS_ID);

        if (!status) {
            return {
                EM: 'Không tìm thấy trạng thái ứng tuyển mặc định (id = 1)!',
                EC: 6,
                DT: ''
            };
        }

        if (!user.SDT && applicantPhone) {
            await user.update({ SDT: applicantPhone });
        }

        const newApplication = await db.JobApplication.create({
            Thugioithieu: coverLetter || '',
            Ngaynop: new Date(),
            Ngaycapnhat: new Date(),
            jobPostingId,
            recordId,
            applicationStatusId: status.id
        });

        return {
            EM: 'Ứng tuyển thành công!',
            EC: 0,
            DT: newApplication
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi ứng tuyển!',
            EC: -1,
            DT: ''
        };
    }
};

const getApplicationsByUser = async (userId) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            };
        }

        const applications = await db.JobApplication.findAll({
            include: [
                {
                    model: db.Record,
                    where: { userId },
                    attributes: ['id', 'Tieude', 'File_url'],
                    required: true
                },
                {
                    model: db.JobPosting,
                    attributes: ['id', 'Tieude', 'Diadiem', 'Luongtoithieu', 'Luongtoida', 'Ngaydang', 'Ngayhethan'],
                    include: [
                        {
                            model: db.Company,
                            attributes: ['id', 'Tencongty', 'Diachi']
                        },
                        {
                            model: db.Format,
                            attributes: ['id', 'TenHinhThuc']
                        }
                    ]
                },
                {
                    model: db.ApplicationStatus,
                    attributes: ['id', 'TenTrangThai']
                },
                {
                    model: db.InterviewRound,
                    as: 'CurrentInterviewRound',
                    required: false,
                    attributes: ['id', 'roundNumber', 'title', 'duration', 'description']
                },
                {
                    model: db.TestSubmission,
                    as: 'TestSubmissions',
                    required: false,
                    attributes: [
                        'id',
                        'Thoigianbatdau',
                        'Thoigianketthuc',
                        'Thoigianconlai',
                        'Hanhethan',
                        'Tongdiemdatduoc',
                        'Trangthai',
                        'createdAt',
                        'updatedAt'
                    ]
                }
            ],
            order: [['Ngaynop', 'DESC']]
        });

        const jobPostingIds = applications
            .map(app => app.JobPosting?.id)
            .filter(id => !!id);

        let testMap = new Map();
        if (jobPostingIds.length > 0) {
            const tests = await db.Test.findAll({
                where: { jobPostingId: jobPostingIds },
                attributes: ['id', 'Tieude', 'Thoigiantoida', 'Ngaybatdau', 'Ngayhethan', 'Trangthai', 'jobPostingId']
            });
            testMap = new Map(tests.map(test => [test.jobPostingId, test.toJSON()]));
        }

        const enrichedApplications = applications.map(app => {
            const json = app.toJSON();
            if (json.JobPosting && json.JobPosting.id) {
                json.JobPosting.Test = testMap.get(json.JobPosting.id) || null;
            }
            return json;
        });

        return {
            EM: 'Lấy danh sách đơn ứng tuyển thành công!',
            EC: 0,
            DT: enrichedApplications
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy danh sách đơn ứng tuyển!',
            EC: -1,
            DT: ''
        };
    }
};

const checkApplied = async (userId, jobPostingId) => {
    try {
        if (!userId || !jobPostingId) {
            return {
                EM: 'Thiếu thông tin kiểm tra!',
                EC: 1,
                DT: ''
            };
        }

        const application = await db.JobApplication.findOne({
            where: { jobPostingId },
            include: [{
                model: db.Record,
                where: { userId },
                attributes: [],
                required: true
            }]
        });

        return {
            EM: 'Kiểm tra thành công!',
            EC: 0,
            DT: {
                hasApplied: application ? true : false
            }
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi kiểm tra ứng tuyển!',
            EC: -1,
            DT: ''
        };
    }
};

const startTestForApplication = async (userId, applicationId) => {
    try {
        if (!userId || !applicationId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const application = await db.JobApplication.findOne({
            where: { id: applicationId },
            include: [
                {
                    model: db.Record,
                    where: { userId },
                    attributes: ['id'],
                    required: true
                },
                {
                    model: db.JobPosting,
                    attributes: ['id'],
                    include: [{
                        model: db.Test,
                        as: 'Test',
                        attributes: ['id', 'Tieude', 'Thoigiantoida', 'Ngaybatdau', 'Ngayhethan', 'Trangthai']
                    }]
                },
                {
                    model: db.ApplicationStatus,
                    attributes: ['id', 'TenTrangThai']
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

        // Chọn bài test còn hiệu lực của JobPosting (cho phép nhiều test nhưng chỉ gửi test active)
        let test = null;
        if (application.JobPosting?.id) {
            const tests = await db.Test.findAll({
                where: { jobPostingId: application.JobPosting.id },
                attributes: ['id', 'Tieude', 'Thoigiantoida', 'Ngaybatdau', 'Ngayhethan', 'Trangthai'],
                order: [['Ngaybatdau', 'ASC'], ['id', 'ASC']]
            });

            for (const t of tests) {
                const state = getTestAccessState(t);
                if (state === 'active') {
                    test = t;
                    break;
                }
            }
        }

        if (!test) {
            return {
                EM: 'Không có bài test còn hiệu lực cho tin tuyển dụng này!',
                EC: 4,
                DT: null
            };
        }

        const duration = test.Thoigiantoida || 60;
        const now = new Date();

        let submission = await db.TestSubmission.findOne({
            where: {
                testId: test.id,
                userId,
                jobApplicationId: application.id
            }
        });

        if (!submission) {
            submission = await db.TestSubmission.create({
                testId: test.id,
                userId,
                jobApplicationId: application.id,
                Thoigianbatdau: now,
                Thoigianconlai: duration,
                Hanhethan: test.Ngayhethan || null,
                Trangthai: 'danglam'
            });
        } else {
            if (submission.Trangthai === 'dacham' || submission.Trangthai === 'danop') {
                return {
                    EM: 'Bạn đã hoàn thành bài test này!',
                    EC: 5,
                    DT: null
                };
            }

            if (submission.Trangthai === 'chuabatdau') {
                await submission.update({
                    Trangthai: 'danglam',
                    Thoigianbatdau: now,
                    Thoigianconlai: duration
                });
            }
        }

        const submissionDetail = await db.TestSubmission.findOne({
            where: { id: submission.id },
            include: [
                {
                    model: db.Test,
                    as: 'Test',
                    include: [{
                        model: db.TestQuestion,
                        as: 'Questions',
                        attributes: ['id', 'Cauhoi', 'Dapan', 'Loaicauhoi', 'Diem', 'Thutu']
                    }]
                },
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    include: [{
                        model: db.JobPosting,
                        attributes: ['id', 'Tieude']
                    }]
                }
            ]
        });

        return {
            EM: 'Bắt đầu làm bài test!',
            EC: 0,
            DT: submissionDetail
        };

    } catch (error) {
        console.error('Error in startTestForApplication:', error);
        return {
            EM: 'Có lỗi xảy ra khi bắt đầu bài test!',
            EC: -1,
            DT: null
        };
    }
};

const getTestSubmissionDetail = async (userId, submissionId) => {
    try {
        if (!userId || !submissionId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: null
            };
        }

        const submission = await db.TestSubmission.findOne({
            where: { id: submissionId, userId },
            include: [
                {
                    model: db.Test,
                    as: 'Test',
                    include: [{
                        model: db.TestQuestion,
                        as: 'Questions',
                        attributes: ['id', 'Cauhoi', 'Dapan', 'Loaicauhoi', 'Diem', 'Thutu']
                    }]
                },
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    include: [{
                        model: db.JobPosting,
                        attributes: ['id', 'Tieude']
                    }]
                }
            ]
        });

        if (!submission) {
            return {
                EM: 'Không tìm thấy thông tin bài test!',
                EC: 2,
                DT: null
            };
        }

        return {
            EM: 'Lấy thông tin bài test thành công!',
            EC: 0,
            DT: submission
        };
    } catch (error) {
        console.error('Error in getTestSubmissionDetail:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy thông tin bài test!',
            EC: -1,
            DT: null
        };
    }
};

export default {
    applyJob,
    checkApplied,
    getApplicationsByUser,
    startTestForApplication,
    getTestSubmissionDetail
};


