import db from '../models/index';

const { Op } = db.Sequelize;

const getDashboardData = async (userId) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            };
        }

        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            include: [
                {
                    model: db.Company,
                    attributes: ['id', 'Tencongty', 'Diachi', 'Website']
                }
            ],
            order: [['updatedAt', 'DESC']]
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: ''
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        const jobPostings = await db.JobPosting.findAll({
            where: { recruiterId: recruiterIds },
            include: [
                {
                    model: db.Company,
                    attributes: ['id', 'Tencongty', 'Diachi']
                },
                {
                    model: db.JobPostingStatus,
                    attributes: ['id', 'TenTrangThai']
                },
                {
                    model: db.Format,
                    attributes: ['id', 'TenHinhThuc']
                }
            ],
            order: [['updatedAt', 'DESC']]
        });

        const jobIds = jobPostings.map(job => job.id);
        const totalJobs = jobPostings.length;
        const activeJobs = jobPostings.filter(job => job.TrangthaiId === 1).length;
        const closedJobs = jobPostings.filter(job => job.TrangthaiId !== 1).length;

        const totalApplications = jobIds.length
            ? await db.JobApplication.count({ where: { jobPostingId: jobIds } })
            : 0;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const newApplications = jobIds.length
            ? await db.JobApplication.count({
                where: {
                    jobPostingId: jobIds,
                    Ngaynop: { [Op.gte]: sevenDaysAgo }
                }
            })
            : 0;

        const recentJobs = jobPostings.slice(0, 5);

        const recentApplications = jobIds.length
            ? await db.JobApplication.findAll({
                where: { jobPostingId: jobIds },
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
                        model: db.ApplicationStatus,
                        attributes: ['id', 'TenTrangThai']
                    },
                    {
                        model: db.Record,
                        attributes: ['id', 'Tieude'],
                        include: [
                            {
                                model: db.User,
                                attributes: ['id', 'Hoten', 'email', 'SDT']
                            }
                        ]
                    }
                ],
                order: [['Ngaynop', 'DESC']],
                limit: 5
            })
            : [];

        const statusSummary = {};
        jobPostings.forEach(job => {
            const statusName = job.JobPostingStatus?.TenTrangThai || 'Khác';
            statusSummary[statusName] = (statusSummary[statusName] || 0) + 1;
        });

        const uniqueCompanies = [];
        const companyMap = new Map();
        recruiters.forEach(rec => {
            if (rec.Company && !companyMap.has(rec.Company.id)) {
                companyMap.set(rec.Company.id, true);
                uniqueCompanies.push(rec.Company);
            }
        });

        return {
            EM: 'Lấy dữ liệu dashboard thành công!',
            EC: 0,
            DT: {
                stats: {
                    totalJobs,
                    activeJobs,
                    closedJobs,
                    totalApplications,
                    newApplications
                },
                statusSummary,
                companies: uniqueCompanies,
                recentJobs,
                recentApplications
            }
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy dữ liệu dashboard!',
            EC: -1,
            DT: ''
        };
    }
};

const getMyJobPostings = async (userId, page = 1, limit = 10) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            };
        }

        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: ''
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Thống kê
        const allJobs = await db.JobPosting.findAll({
            where: { recruiterId: recruiterIds },
            attributes: ['id', 'TrangthaiId']
        });

        const totalJobs = allJobs.length;
        const activeJobs = allJobs.filter(job => job.TrangthaiId === 1).length;
        const inactiveJobs = allJobs.filter(job => job.TrangthaiId === 2).length;

        // Lấy danh sách job postings với phân trang
        const offset = (page - 1) * limit;

        const { count, rows } = await db.MajorJobPosting.findAndCountAll({
            include: [
                {
                    model: db.JobPosting,
                    required: true,
                    where: { recruiterId: recruiterIds },
                    include: [
                        {
                            model: db.Company,
                            attributes: ['id', 'Tencongty', 'Diachi', 'Website']
                        },
                        {
                            model: db.Format,
                            attributes: ['id', 'TenHinhThuc']
                        },
                        {
                            model: db.JobPostingStatus,
                            attributes: ['id', 'TenTrangThai']
                        },
                        {
                            model: db.Recruiter,
                            attributes: ['id', 'Chucvu', 'SDT'],
                            include: [
                                {
                                    model: db.User,
                                    attributes: ['id', 'Hoten', 'email']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: db.Major,
                    attributes: ['id', 'TenNghanhNghe']
                }
            ],
            distinct: true,
            col: 'jobPostingId',
            offset: offset,
            limit: limit,
            order: [[db.JobPosting, 'updatedAt', 'DESC']]
        });

        // Nhóm majors theo job posting
        const jobsMap = new Map();
        rows.forEach(mj => {
            const job = mj.JobPosting.toJSON();
            const major = mj.Major.toJSON();
            if (!jobsMap.has(job.id)) {
                jobsMap.set(job.id, { ...job, majors: [] });
            }
            jobsMap.get(job.id).majors.push(major);
        });

        const jobsWithMajors = Array.from(jobsMap.values());
        const totalPages = Math.ceil(count / limit);

        return {
            EM: 'Lấy danh sách tin tuyển dụng thành công!',
            EC: 0,
            DT: {
                stats: {
                    totalJobs,
                    activeJobs,
                    inactiveJobs
                },
                jobs: jobsWithMajors,
                pagination: {
                    totalRows: count,
                    totalPages,
                    currentPage: page,
                    limit
                }
            }
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy danh sách tin tuyển dụng!',
            EC: -1,
            DT: ''
        };
    }
};

const getJobPostingDetailForHr = async (userId, jobId) => {
    try {
        if (!userId || !jobId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            };
        }

        // Get recruiter info
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn không có quyền truy cập!',
                EC: 2,
                DT: ''
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Get job posting detail
        const job = await db.JobPosting.findOne({
            where: { 
                id: jobId,
                recruiterId: recruiterIds // Ensure HR can only access their own jobs
            },
            include: [
                {
                    model: db.Company,
                    attributes: ['id', 'Tencongty', 'Diachi', 'Website', 'Mota']
                },
                {
                    model: db.Format,
                    attributes: ['id', 'TenHinhThuc']
                },
                {
                    model: db.JobPostingStatus,
                    attributes: ['id', 'TenTrangThai']
                },
                {
                    model: db.Recruiter,
                    attributes: ['id', 'Chucvu', 'SDT'],
                    include: [{
                        model: db.User,
                        attributes: ['id', 'Hoten', 'email']
                    }]
                }
            ]
        });

        if (!job) {
            return {
                EM: 'Không tìm thấy tin tuyển dụng hoặc bạn không có quyền truy cập!',
                EC: 3,
                DT: ''
            };
        }

        // Get majors for this job
        const majorJobPostings = await db.MajorJobPosting.findAll({
            where: { jobPostingId: jobId },
            include: [{
                model: db.Major,
                attributes: ['id', 'TenNghanhNghe']
            }]
        });

        const jobData = job.toJSON();
        jobData.majors = majorJobPostings.map(mj => mj.Major);

        return {
            EM: 'Lấy thông tin tin tuyển dụng thành công!',
            EC: 0,
            DT: jobData
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy thông tin tin tuyển dụng!',
            EC: -1,
            DT: ''
        };
    }
};

const deleteJobPostingForHr = async (userId, jobId) => {
    try {
        if (!userId || !jobId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            };
        }

        // Get recruiter info
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn không có quyền truy cập!',
                EC: 2,
                DT: ''
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Check if job belongs to this HR
        const job = await db.JobPosting.findOne({
            where: { 
                id: jobId,
                recruiterId: recruiterIds
            }
        });

        if (!job) {
            return {
                EM: 'Không tìm thấy tin tuyển dụng hoặc bạn không có quyền xóa!',
                EC: 3,
                DT: ''
            };
        }

        // Delete related majors first
        await db.MajorJobPosting.destroy({ where: { jobPostingId: jobId } });
        
        // Delete job posting
        await db.JobPosting.destroy({ where: { id: jobId } });

        return {
            EM: 'Xóa tin tuyển dụng thành công!',
            EC: 0,
            DT: ''
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi xóa tin tuyển dụng!',
            EC: -1,
            DT: ''
        };
    }
};

const createJobPostingForHr = async (userId, data) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            };
        }

        // Validate input
        if (!data.Tieude || !data.companyId) {
            return {
                EM: 'Vui lòng điền đầy đủ thông tin!',
                EC: 2,
                DT: ''
            };
        }

        // Get recruiter info for this user and company
        const recruiter = await db.Recruiter.findOne({
            where: { 
                userId: userId,
                companyId: data.companyId
            }
        });

        if (!recruiter) {
            return {
                EM: 'Bạn không có quyền tạo tin tuyển dụng cho công ty này!',
                EC: 3,
                DT: ''
            };
        }

        // Create job posting
        const newJob = await db.JobPosting.create({
            Tieude: data.Tieude,
            Mota: data.Mota,
            Diadiem: data.Diadiem,
            Luongtoithieu: data.Luongtoithieu,
            Luongtoida: data.Luongtoida,
            Kinhnghiem: data.Kinhnghiem,
            TrangthaiId: data.TrangthaiId || 1, // Default: ACTIVE
            Ngaydang: new Date(),
            Ngayhethan: data.Ngayhethan,
            companyId: data.companyId,
            recruiterId: recruiter.id,
            formatId: data.formatId
        });

        // Add majors if provided
        if (data.majorIds && data.majorIds.length > 0) {
            const majorJobPostings = data.majorIds.map(majorId => ({
                majorId: majorId,
                jobPostingId: newJob.id
            }));
            await db.MajorJobPosting.bulkCreate(majorJobPostings);
        }

        return {
            EM: 'Tạo tin tuyển dụng thành công!',
            EC: 0,
            DT: newJob
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi tạo tin tuyển dụng!',
            EC: -1,
            DT: ''
        };
    }
};

const updateJobPostingForHr = async (userId, jobId, data) => {
    try {
        if (!userId || !jobId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            };
        }

        // Get recruiter info
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn không có quyền truy cập!',
                EC: 2,
                DT: ''
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Check if job belongs to this HR
        const job = await db.JobPosting.findOne({
            where: { 
                id: jobId,
                recruiterId: recruiterIds
            }
        });

        if (!job) {
            return {
                EM: 'Không tìm thấy tin tuyển dụng hoặc bạn không có quyền chỉnh sửa!',
                EC: 3,
                DT: ''
            };
        }

        // Update job posting
        await db.JobPosting.update(
            {
                Tieude: data.Tieude || job.Tieude,
                Mota: data.Mota !== undefined ? data.Mota : job.Mota,
                Diadiem: data.Diadiem || job.Diadiem,
                Luongtoithieu: data.Luongtoithieu !== undefined ? data.Luongtoithieu : job.Luongtoithieu,
                Luongtoida: data.Luongtoida !== undefined ? data.Luongtoida : job.Luongtoida,
                Kinhnghiem: data.Kinhnghiem !== undefined ? data.Kinhnghiem : job.Kinhnghiem,
                TrangthaiId: data.TrangthaiId !== undefined ? data.TrangthaiId : job.TrangthaiId,
                Ngayhethan: data.Ngayhethan || job.Ngayhethan,
                formatId: data.formatId || job.formatId
            },
            { where: { id: jobId } }
        );

        // Update majors if provided
        if (data.majorIds !== undefined) {
            // Delete old majors
            await db.MajorJobPosting.destroy({ where: { jobPostingId: jobId } });
            
            // Add new majors
            if (data.majorIds.length > 0) {
                const majorJobPostings = data.majorIds.map(majorId => ({
                    majorId: majorId,
                    jobPostingId: jobId
                }));
                await db.MajorJobPosting.bulkCreate(majorJobPostings);
            }
        }

        return {
            EM: 'Cập nhật tin tuyển dụng thành công!',
            EC: 0,
            DT: ''
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi cập nhật tin tuyển dụng!',
            EC: -1,
            DT: ''
        };
    }
};

export default {
    getDashboardData,
    getMyJobPostings,
    getJobPostingDetailForHr,
    deleteJobPostingForHr,
    createJobPostingForHr,
    updateJobPostingForHr
};


