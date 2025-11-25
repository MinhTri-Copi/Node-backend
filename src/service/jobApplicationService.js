import db from '../models/index';

const DEFAULT_STATUS_ID = 1; // Đang chờ

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
                }
            ],
            order: [['Ngaynop', 'DESC']]
        });

        return {
            EM: 'Lấy danh sách đơn ứng tuyển thành công!',
            EC: 0,
            DT: applications
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

export default {
    applyJob,
    checkApplied,
    getApplicationsByUser
};


