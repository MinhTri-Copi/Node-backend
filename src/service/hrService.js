import db from '../models/index';
import emailService from './emailService';

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

        // Tự động chuyển trạng thái từ "Đang tuyển" (1) sang "Ngừng tuyển" (2) nếu đã hết hạn
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set về đầu ngày để so sánh

        await db.JobPosting.update(
            { TrangthaiId: 2 }, // Ngừng tuyển
            {
                where: {
                    recruiterId: recruiterIds,
                    TrangthaiId: 1, // Đang tuyển
                    Ngayhethan: {
                        [Op.lte]: today // Ngày hết hạn <= ngày hiện tại
                    }
                }
            }
        );

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

        const { count, rows } = await db.JobPosting.findAndCountAll({
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
                },
                {
                    model: db.Major,
                    attributes: ['id', 'TenNghanhNghe'],
                    through: { attributes: [] }
                }
            ],
            distinct: true,
            offset,
            limit,
            order: [['updatedAt', 'DESC']]
        });

        const jobsWithMajors = rows.map(job => {
            const jobData = job.toJSON();
            jobData.majors = jobData.Majors || [];
            delete jobData.Majors;
            return jobData;
        });
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

/**
 * Get companies that HR can create job postings for
 * @param {number} userId - HR user ID
 * @returns {object} - List of companies
 */
const getMyCompaniesForHr = async (userId) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: []
            };
        }

        // Get all recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            include: [{
                model: db.Company,
                attributes: ['id', 'Tencongty', 'Diachi', 'Website']
            }],
            attributes: ['id', 'companyId']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: []
            };
        }

        // Extract unique companies
        const companies = [];
        const companyMap = new Map();
        recruiters.forEach(recruiter => {
            if (recruiter.Company && !companyMap.has(recruiter.Company.id)) {
                companyMap.set(recruiter.Company.id, recruiter.Company);
                companies.push(recruiter.Company);
            }
        });

        return {
            EM: 'Lấy danh sách công ty thành công!',
            EC: 0,
            DT: companies
        };
    } catch (error) {
        console.error('Error in getMyCompaniesForHr:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách công ty!',
            EC: -1,
            DT: []
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

/**
 * Get list of job applications for HR's job postings
 * @param {number} userId - The HR user ID
 * @param {object} filters - Filter options (status, page, limit)
 * @returns {object} - Applications list with pagination
 */
/**
 * Get job postings that have applications for HR
 * @param {number} userId - The HR user ID
 * @returns {object} - List of job postings with applications
 */
const getActiveJobPostingsForHr = async (userId) => {
    try {
        console.log('=== getActiveJobPostingsForHr START ===');
        console.log('userId:', userId);
        
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: []
            };
        }

        // Get recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });
        console.log('Recruiters found:', recruiters.length);
        console.log('Recruiter IDs:', recruiters.map(r => r.id));

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: []
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Get all job postings for these recruiters
        const allJobPostings = await db.JobPosting.findAll({
            where: { recruiterId: recruiterIds },
            attributes: ['id']
        });
        console.log('Job postings found:', allJobPostings.length);
        console.log('Job posting IDs:', allJobPostings.map(jp => jp.id));

        if (!allJobPostings || allJobPostings.length === 0) {
            return {
                EM: 'Bạn chưa có tin tuyển dụng nào!',
                EC: 3,
                DT: []
            };
        }

        const jobPostingIds = allJobPostings.map(jp => jp.id);

        // Get all applications for these job postings
        const applications = await db.JobApplication.findAll({
            where: { jobPostingId: jobPostingIds },
            attributes: ['jobPostingId'],
            include: [
                {
                    model: db.JobPosting,
                    attributes: ['id', 'Tieude', 'Diadiem'],
                    include: [
                        {
                            model: db.Company,
                            attributes: ['id', 'Tencongty']
                        }
                    ]
                }
            ]
        });
        console.log('Applications found:', applications.length);

        if (!applications || applications.length === 0) {
            console.log('NO APPLICATIONS FOUND!');
            return {
                EM: 'Chưa có ứng viên nào ứng tuyển!',
                EC: 4,
                DT: []
            };
        }

        // Extract unique job postings using a Map
        const jobPostingsMap = new Map();
        applications.forEach((app, index) => {
            console.log(`Application ${index}:`, {
                jobPostingId: app.jobPostingId,
                hasJobPosting: !!app.JobPosting,
                jobPostingData: app.JobPosting ? {
                    id: app.JobPosting.id,
                    Tieude: app.JobPosting.Tieude,
                    hasCompany: !!app.JobPosting.Company
                } : null
            });
            
            if (app.JobPosting && !jobPostingsMap.has(app.JobPosting.id)) {
                jobPostingsMap.set(app.JobPosting.id, app.JobPosting.toJSON());
            }
        });

        const uniqueJobPostings = Array.from(jobPostingsMap.values());
        console.log('Unique job postings:', uniqueJobPostings.length);
        console.log('=== getActiveJobPostingsForHr END ===');

        return {
            EM: 'Lấy danh sách tin tuyển dụng thành công!',
            EC: 0,
            DT: uniqueJobPostings
        };
    } catch (error) {
        console.error('Error in getActiveJobPostingsForHr:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách tin tuyển dụng!',
            EC: -1,
            DT: []
        };
    }
};

const getJobApplicationsForHr = async (userId, filters = {}) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            };
        }

        // Get recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id', 'companyId'],
            include: [{
                model: db.Company,
                attributes: ['id', 'Tencongty']
            }]
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: ''
            };
        }

        const recruiterIds = recruiters.map(r => r.id);
        console.log('=== DEBUG getJobApplicationsForHr ===');
        console.log('userId:', userId);
        console.log('Recruiters:', recruiters.map(r => ({ 
            id: r.id, 
            companyId: r.companyId,
            companyName: r.Company?.Tencongty 
        })));
        console.log('recruiterIds:', recruiterIds);

        // Get job postings for these recruiters
        const jobPostings = await db.JobPosting.findAll({
            where: { recruiterId: recruiterIds },
            attributes: ['id', 'Tieude', 'recruiterId'],
            include: [{
                model: db.Company,
                attributes: ['id', 'Tencongty']
            }]
        });

        console.log('Job Postings found:', jobPostings.length);
        console.log('Job Postings:', jobPostings.map(jp => ({
            id: jp.id,
            Tieude: jp.Tieude,
            recruiterId: jp.recruiterId,
            companyName: jp.Company?.Tencongty
        })));

        if (!jobPostings || jobPostings.length === 0) {
            return {
                EM: 'Chưa có tin tuyển dụng nào!',
                EC: 3,
                DT: {
                    applications: [],
                    totalRows: 0,
                    totalPages: 0,
                    currentPage: 1
                }
            };
        }

        const jobPostingIds = jobPostings.map(jp => jp.id);
        console.log('jobPostingIds:', jobPostingIds);

        // Build where clause
        const whereClause = {
            jobPostingId: jobPostingIds
        };

        // Filter by specific job posting
        if (filters.jobPostingId && filters.jobPostingId !== 'all') {
            whereClause.jobPostingId = filters.jobPostingId;
        }

        // Filter by status if provided
        if (filters.statusId && filters.statusId !== 'all') {
            whereClause.applicationStatusId = filters.statusId;
        }

        // Build include with search
        const includeOptions = [
            {
                model: db.JobPosting,
                attributes: ['id', 'Tieude', 'Mota', 'Luongtoithieu', 'Luongtoida', 'Ngaydang', 'Ngayhethan'],
                include: [
                    {
                        model: db.Company,
                        attributes: ['id', 'Tencongty', 'Diachi']
                    },
                    {
                        model: db.Format,
                        attributes: ['id', 'TenHinhThuc']
                    }
                ],
                ...(filters.search && {
                    where: {
                        [Op.or]: [
                            { Tieude: { [Op.like]: `%${filters.search}%` } }
                        ]
                    }
                })
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
                model: db.Record,
                attributes: ['id', 'Tieude', 'File_url', 'userId'],
                include: [
                    {
                        model: db.User,
                        attributes: ['id', 'Hoten', 'email', 'SDT'],
                        ...(filters.search && {
                            where: {
                                [Op.or]: [
                                    { Hoten: { [Op.like]: `%${filters.search}%` } },
                                    { email: { [Op.like]: `%${filters.search}%` } },
                                    { SDT: { [Op.like]: `%${filters.search}%` } }
                                ]
                            }
                        })
                    }
                ]
            }
        ];

        // Pagination
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total count
        const totalRows = await db.JobApplication.count({
            where: whereClause,
            include: includeOptions,
            distinct: true
        });

        // Get applications with full details
        const applications = await db.JobApplication.findAll({
            where: whereClause,
            include: includeOptions,
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: offset,
            distinct: true
        });

        const totalPages = Math.ceil(totalRows / limit);

        return {
            EM: 'Lấy danh sách ứng viên thành công!',
            EC: 0,
            DT: {
                applications: applications,
                totalRows: totalRows,
                totalPages: totalPages,
                currentPage: page
            }
        };

    } catch (error) {
        console.error('Error in getJobApplicationsForHr:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách ứng viên!',
            EC: -1,
            DT: ''
        };
    }
};

/**
 * Get statistics for job applications
 * @param {number} userId - The HR user ID
 * @returns {object} - Application statistics
 */
const getApplicationStatistics = async (userId) => {
    try {
        if (!userId) {
            return {
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: ''
            };
        }

        // Get recruiters for this user
        const recruiters = await db.Recruiter.findAll({
            where: { userId },
            attributes: ['id']
        });

        if (!recruiters || recruiters.length === 0) {
            return {
                EM: 'Bạn chưa được gán vào bất kỳ công ty nào!',
                EC: 2,
                DT: {
                    total: 0,
                    pending: 0,
                    approved: 0,
                    rejected: 0
                }
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        // Get job postings for these recruiters
        const jobPostings = await db.JobPosting.findAll({
            where: { recruiterId: recruiterIds },
            attributes: ['id']
        });

        if (!jobPostings || jobPostings.length === 0) {
            return {
                EM: 'Chưa có tin tuyển dụng nào!',
                EC: 3,
                DT: {
                    total: 0,
                    pending: 0,
                    approved: 0,
                    rejected: 0
                }
            };
        }

        const jobPostingIds = jobPostings.map(jp => jp.id);

        // Get statistics
        const [total, pending, approved, rejected] = await Promise.all([
            db.JobApplication.count({
                where: { jobPostingId: jobPostingIds }
            }),
            db.JobApplication.count({
                where: { 
                    jobPostingId: jobPostingIds,
                    applicationStatusId: 1 // Đang chờ
                }
            }),
            db.JobApplication.count({
                where: { 
                    jobPostingId: jobPostingIds,
                    applicationStatusId: 4 // Đã xét duyệt
                }
            }),
            db.JobApplication.count({
                where: { 
                    jobPostingId: jobPostingIds,
                    applicationStatusId: 3 // Từ chối
                }
            })
        ]);

        return {
            EM: 'Lấy thống kê thành công!',
            EC: 0,
            DT: {
                total,
                pending,
                approved,
                rejected
            }
        };

    } catch (error) {
        console.error('Error in getApplicationStatistics:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy thống kê!',
            EC: -1,
            DT: ''
        };
    }
};

/**
 * Get detail of a specific job application
 * @param {number} userId - The HR user ID
 * @param {number} applicationId - The application ID
 * @returns {object} - Application details
 */
const getApplicationDetail = async (userId, applicationId) => {
    try {
        if (!userId || !applicationId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            };
        }

        // Get recruiters for this user
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

        // Get application with full details
        const application = await db.JobApplication.findOne({
            where: { id: applicationId },
            include: [
                {
                    model: db.JobPosting,
                    attributes: ['id', 'Tieude', 'Mota', 'Luongtoithieu', 'Luongtoida', 'Ngaydang', 'Ngayhethan', 'Kinhnghiem', 'Diadiem', 'recruiterId'],
                    include: [
                        {
                            model: db.Company,
                            attributes: ['id', 'Tencongty', 'Diachi', 'Website', 'Mota']
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
                    model: db.Record,
                    attributes: ['id', 'Tieude', 'File_url', 'Ngaytao', 'userId'],
                    include: [
                        {
                            model: db.User,
                            attributes: ['id', 'Hoten', 'email', 'SDT']
                        }
                    ]
                }
            ]
        });

        if (!application) {
            return {
                EM: 'Không tìm thấy đơn ứng tuyển!',
                EC: 3,
                DT: ''
            };
        }

        // Check if this application belongs to HR's job postings
        if (!recruiterIds.includes(application.JobPosting.recruiterId)) {
            return {
                EM: 'Bạn không có quyền xem đơn ứng tuyển này!',
                EC: 4,
                DT: ''
            };
        }

        return {
            EM: 'Lấy chi tiết đơn ứng tuyển thành công!',
            EC: 0,
            DT: application
        };

    } catch (error) {
        console.error('Error in getApplicationDetail:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy chi tiết đơn ứng tuyển!',
            EC: -1,
            DT: ''
        };
    }
};

/**
 * Update application status (Approve/Reject)
 * @param {number} userId - The HR user ID
 * @param {number} applicationId - The application ID
 * @param {number} newStatusId - The new status ID
 * @returns {object} - Result
 */
const updateApplicationStatus = async (userId, applicationId, newStatusId) => {
    try {
        if (!userId || !applicationId || !newStatusId) {
            return {
                EM: 'Thiếu thông tin!',
                EC: 1,
                DT: ''
            };
        }

        // Get recruiters for this user
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

        // Get application
        const application = await db.JobApplication.findOne({
            where: { id: applicationId },
            include: [
                {
                    model: db.JobPosting,
                    attributes: ['id', 'recruiterId']
                }
            ]
        });

        if (!application) {
            return {
                EM: 'Không tìm thấy đơn ứng tuyển!',
                EC: 3,
                DT: ''
            };
        }

        // Check ownership
        if (!recruiterIds.includes(application.JobPosting.recruiterId)) {
            return {
                EM: 'Bạn không có quyền cập nhật đơn ứng tuyển này!',
                EC: 4,
                DT: ''
            };
        }

        // If status is 7 (Chuẩn bị phỏng vấn), determine current round and find next round
        let currentInterviewRound = null;
        let nextInterviewRound = null;
        const jobPostingId = application.jobPostingId || application.JobPosting?.id;
        
        if (newStatusId === 7) {
            console.log(`🔍 Đang xác định vòng phỏng vấn cho job posting ID: ${jobPostingId}`);
            
            // Find the most recent completed meeting for this application to determine current round
            const latestMeeting = await db.Meeting.findOne({
                where: {
                    jobApplicationId: applicationId,
                    status: 'done'
                },
                include: [{
                    model: db.InterviewRound,
                    as: 'InterviewRound',
                    attributes: ['id', 'roundNumber', 'title', 'duration', 'description']
                }],
                order: [['finishedAt', 'DESC']]
            });

            if (latestMeeting && latestMeeting.InterviewRound) {
                currentInterviewRound = latestMeeting.InterviewRound;
                console.log(`✅ Tìm thấy vòng phỏng vấn hiện tại: ID=${currentInterviewRound.id}, roundNumber=${currentInterviewRound.roundNumber}, title=${currentInterviewRound.title}`);
                
                // Find next round
                nextInterviewRound = await db.InterviewRound.findOne({
                    where: {
                        jobPostingId: jobPostingId,
                        roundNumber: currentInterviewRound.roundNumber + 1,
                        isActive: true
                    }
                });

                if (nextInterviewRound) {
                    console.log(`✅ Tìm thấy vòng phỏng vấn tiếp theo: ID=${nextInterviewRound.id}, roundNumber=${nextInterviewRound.roundNumber}, title=${nextInterviewRound.title}`);
                } else {
                    console.log(`ℹ️ Không có vòng phỏng vấn tiếp theo. Đây là vòng cuối cùng.`);
                }
            } else {
                // No completed meeting found, this might be first time approving (from test/application review)
                // Find first interview round
                console.log(`⚠️ Không tìm thấy meeting đã hoàn thành. Tìm vòng phỏng vấn đầu tiên...`);
                nextInterviewRound = await db.InterviewRound.findOne({
                    where: {
                        jobPostingId: jobPostingId,
                        roundNumber: 1,
                        isActive: true
                    }
                });

                if (nextInterviewRound) {
                    console.log(`✅ Tìm thấy vòng phỏng vấn đầu tiên: ID=${nextInterviewRound.id}, roundNumber=${nextInterviewRound.roundNumber}, title=${nextInterviewRound.title}`);
                } else {
                    // Try to find any active round if round 1 doesn't exist
                    nextInterviewRound = await db.InterviewRound.findOne({
                        where: {
                            jobPostingId: jobPostingId,
                            isActive: true
                        },
                        order: [['roundNumber', 'ASC']]
                    });
                    if (nextInterviewRound) {
                        console.log(`⚠️ Tìm thấy vòng phỏng vấn khác (roundNumber=${nextInterviewRound.roundNumber}) thay vì vòng 1`);
                    }
                }
            }
        }

        // Update status and currentInterviewRoundId
        const updateData = {
            applicationStatusId: newStatusId,
            Ngaycapnhat: new Date()
        };

        // If there's a next round, set it as currentInterviewRoundId
        // If no next round (passed all rounds), update status to 2 (Đã được nhận) instead of 7
        if (nextInterviewRound) {
            updateData.currentInterviewRoundId = nextInterviewRound.id;
            console.log(`📝 Sẽ cập nhật currentInterviewRoundId = ${nextInterviewRound.id} (vòng ${nextInterviewRound.roundNumber}) cho application ${applicationId}`);
        } else if (newStatusId === 7 && currentInterviewRound) {
            // Passed all rounds, no next round - update status to 2 (Đã được nhận) instead of 7
            updateData.applicationStatusId = 2; // Đã được nhận
            console.log(`✅ Ứng viên đã vượt qua tất cả các vòng. Cập nhật statusId=2 (Đã được nhận) cho application ${applicationId}`);
        } else {
            console.warn(`⚠️ Không có vòng phỏng vấn để set cho application ${applicationId}`);
        }

        await application.update(updateData);
        console.log(`✅ Đã cập nhật application ${applicationId}: statusId=${updateData.applicationStatusId}, currentInterviewRoundId=${updateData.currentInterviewRoundId || 'NULL'}`);

        // Không chờ email/test assignment để trả response (tránh timeout UI)
        if (newStatusId === 4 || newStatusId === 3 || newStatusId === 7) {
            setImmediate(async () => {
                try {
                    // Get full application details for email
                    const fullApplication = await db.JobApplication.findOne({
                        where: { id: applicationId },
                        include: [
                            {
                                model: db.JobPosting,
                                attributes: ['id', 'Tieude', 'Mota'],
                                include: [
                                    {
                                        model: db.Company,
                                        attributes: ['id', 'Tencongty', 'Diachi', 'Website']
                                    }
                                ]
                            },
                            {
                                model: db.Record,
                                include: [
                                    {
                                        model: db.User,
                                        attributes: ['id', 'Hoten', 'email', 'SDT']
                                    }
                                ]
                            }
                        ]
                    });

                    if (fullApplication && fullApplication.Record && fullApplication.Record.User) {
                        const candidateInfo = {
                            id: fullApplication.Record.User.id,
                            email: fullApplication.Record.User.email,
                            Hoten: fullApplication.Record.User.Hoten
                        };
                        const jobInfo = {
                            id: fullApplication.JobPosting.id,
                            Tieude: fullApplication.JobPosting.Tieude
                        };
                        const companyInfo = {
                            Tencongty: fullApplication.JobPosting.Company.Tencongty
                        };

                        // Send appropriate email based on status
                        if (newStatusId === 4) {
                            await emailService.sendApprovalEmail(candidateInfo, jobInfo, companyInfo);
                            console.log('✅ Đã gửi email thông báo duyệt đến:', candidateInfo.email);

                            // Check test assignment: gán TẤT CẢ bài test đang hoạt động/còn hạn của JobPosting
                            const now = new Date();
                            const activeTests = await db.Test.findAll({
                                where: {
                                    jobPostingId: jobInfo.id,
                                    Trangthai: 1,
                                    [Op.and]: [
                                        {
                                            [Op.or]: [
                                                { Ngaybatdau: null },
                                                { Ngaybatdau: { [Op.lte]: now } }
                                            ]
                                        },
                                        {
                                            [Op.or]: [
                                                { Ngayhethan: null },
                                                { Ngayhethan: { [Op.gte]: now } }
                                            ]
                                        }
                                    ]
                                },
                                order: [['Ngaybatdau', 'ASC'], ['id', 'ASC']]
                            });

                            for (const test of activeTests) {
                                let submission = await db.TestSubmission.findOne({
                                    where: {
                                        testId: test.id,
                                        userId: candidateInfo.id,
                                        jobApplicationId: fullApplication.id
                                    }
                                });

                                let assignmentCreated = false;

                                if (!submission) {
                                    submission = await db.TestSubmission.create({
                                        testId: test.id,
                                        userId: candidateInfo.id,
                                        jobApplicationId: fullApplication.id,
                                        Trangthai: 'chuabatdau',
                                        Thoigianconlai: test.Thoigiantoida || 60,
                                        Hanhethan: test.Ngayhethan || null
                                    });
                                    assignmentCreated = true;
                                }

                                if (assignmentCreated) {
                                    await emailService.sendTestAssignmentEmail(
                                        candidateInfo,
                                        jobInfo,
                                        {
                                            testTitle: test.Tieude,
                                            duration: test.Thoigiantoida || 60,
                                            deadline: test.Ngayhethan ? new Date(test.Ngayhethan).toLocaleDateString('vi-VN') : 'Không giới hạn'
                                        },
                                        companyInfo
                                    );
                                    console.log('📨 Đã gán bài test và gửi email cho:', candidateInfo.email, ' | test:', test.Tieude);
                                }
                            }
                        } else if (newStatusId === 3) {
                            // Rejected - send rejection email
                            await emailService.sendRejectionEmail(candidateInfo, jobInfo, companyInfo);
                            console.log('✅ Đã gửi email thông báo từ chối đến:', candidateInfo.email);
                        } else if (newStatusId === 7) {
                            // Approve after meeting or from test/application review
                            if (currentInterviewRound) {
                                // This is approval after a meeting - check if there's a next round
                                if (nextInterviewRound) {
                                    // There's a next round - send "passed current round, prepare for next round" email
                                    const currentRoundInfo = {
                                        roundNumber: currentInterviewRound.roundNumber,
                                        title: currentInterviewRound.title
                                    };
                                    
                                    const nextRoundInfo = {
                                        roundNumber: nextInterviewRound.roundNumber,
                                        title: nextInterviewRound.title,
                                        duration: nextInterviewRound.duration,
                                        description: nextInterviewRound.description
                                    };
                                    
                                    await emailService.sendInterviewPassEmail(
                                        candidateInfo,
                                        jobInfo,
                                        companyInfo,
                                        currentRoundInfo,
                                        nextRoundInfo
                                    );
                                    console.log(`✅ Đã gửi email thông báo đã đậu vòng ${currentRoundInfo.roundNumber}, chuẩn bị vòng ${nextRoundInfo.roundNumber} đến:`, candidateInfo.email);
                                } else {
                                    // No next round - candidate passed all rounds, send hiring congratulations email
                                    // Note: Status đã được cập nhật thành 2 ở phần update chính phía trên
                                    const lastRoundInfo = {
                                        roundNumber: currentInterviewRound.roundNumber,
                                        title: currentInterviewRound.title
                                    };
                                    
                                    await emailService.sendHiringCongratulationsEmail(
                                        candidateInfo,
                                        jobInfo,
                                        companyInfo,
                                        lastRoundInfo
                                    );
                                    console.log('✅ Đã gửi email chúc mừng đã được tuyển đến:', candidateInfo.email);
                                }
                            } else if (nextInterviewRound) {
                                // No meeting found - this is first time approval (from test/application review)
                                // Send interview notification email for first round
                                const interviewRoundInfo = {
                                    roundNumber: nextInterviewRound.roundNumber,
                                    title: nextInterviewRound.title,
                                    duration: nextInterviewRound.duration,
                                    description: nextInterviewRound.description
                                };
                                
                                await emailService.sendInterviewNotificationEmail(
                                    candidateInfo, 
                                    jobInfo, 
                                    companyInfo,
                                    interviewRoundInfo
                                );
                                console.log('✅ Đã gửi email thông báo phỏng vấn (vòng đầu tiên) đến:', candidateInfo.email);
                            } else {
                                // No interview rounds configured - fallback to interview notification
                                await emailService.sendInterviewNotificationEmail(
                                    candidateInfo, 
                                    jobInfo, 
                                    companyInfo,
                                    null
                                );
                                console.log('✅ Đã gửi email thông báo phỏng vấn (không có thông tin vòng) đến:', candidateInfo.email);
                            }
                        }
                    }
                } catch (emailError) {
                    // Log error but don't fail the status update
                    console.error('⚠️ Không thể gửi email thông báo:', emailError);
                }
            });
        }

        return {
            EM: 'Cập nhật trạng thái thành công!',
            EC: 0,
            DT: {
                applicationId,
                newStatusId,
                currentInterviewRoundId: updateData.currentInterviewRoundId || null
            }
        };

    } catch (error) {
        console.error('Error in updateApplicationStatus:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật trạng thái!',
            EC: -1,
            DT: ''
        };
    }
};

const getTestSubmissionsForHr = async (userId, filters = {}) => {
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
                DT: {
                    submissions: [],
                    pagination: {
                        totalRows: 0,
                        totalPages: 0,
                        currentPage: 1,
                        limit: filters.limit || 10
                    },
                    stats: { total: 0, pending: 0, graded: 0 },
                    filterOptions: {
                        jobPostings: []
                    }
                }
            };
        }

        const recruiterIds = recruiters.map(r => r.id);

        const jobPostings = await db.JobPosting.findAll({
            where: { recruiterId: recruiterIds },
            attributes: ['id', 'Tieude', 'companyId'],
            include: [{
                model: db.Company,
                attributes: ['id', 'Tencongty']
            }]
        });

        if (!jobPostings || jobPostings.length === 0) {
            return {
                EM: 'Bạn chưa có tin tuyển dụng nào!',
                EC: 3,
                DT: {
                    submissions: [],
                    pagination: {
                        totalRows: 0,
                        totalPages: 0,
                        currentPage: 1,
                        limit: filters.limit || 10
                    },
                    stats: { total: 0, pending: 0, graded: 0 },
                    filterOptions: {
                        jobPostings: []
                    }
                }
            };
        }

        const jobPostingIds = jobPostings.map(job => job.id);
        const jobOptions = jobPostings.map(job => ({
            id: job.id,
            title: job.Tieude,
            companyName: job.Company?.Tencongty || ''
        }));

        const tests = await db.Test.findAll({
            where: { jobPostingId: jobPostingIds },
            attributes: ['id', 'Tieude', 'jobPostingId']
        });

        if (!tests || tests.length === 0) {
            return {
                EM: 'Chưa có bài test nào cho các tin tuyển dụng của bạn!',
                EC: 4,
                DT: {
                    submissions: [],
                    pagination: {
                        totalRows: 0,
                        totalPages: 0,
                        currentPage: 1,
                        limit: filters.limit || 10
                    },
                    stats: { total: 0, pending: 0, graded: 0 },
                    filterOptions: {
                        jobPostings: jobOptions
                    }
                }
            };
        }

        let testIds = tests.map(test => test.id);

        if (filters.jobPostingId && filters.jobPostingId !== 'all') {
            const targetJobId = parseInt(filters.jobPostingId);
            const filteredTestIds = tests
                .filter(test => test.jobPostingId === targetJobId)
                .map(test => test.id);

            if (filteredTestIds.length === 0) {
                return {
                    EM: 'Tin tuyển dụng này chưa có bài test!',
                    EC: 0,
                    DT: {
                        submissions: [],
                        pagination: {
                            totalRows: 0,
                            totalPages: 0,
                            currentPage: 1,
                            limit: filters.limit || 10
                        },
                        stats: { total: 0, pending: 0, graded: 0 },
                        filterOptions: {
                            jobPostings: jobOptions
                        }
                    }
                };
            }

            testIds = filteredTestIds;
        }

        const allowedStatuses = ['danop', 'dacham'];

        const baseWhere = {
            testId: testIds
        };

        if (filters.status && filters.status !== 'all') {
            baseWhere.Trangthai = filters.status;
        } else {
            baseWhere.Trangthai = { [Op.in]: allowedStatuses };
        }

        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 10;
        const offset = (page - 1) * limit;

        const userInclude = {
            model: db.User,
            as: 'User',
            attributes: ['id', 'Hoten', 'email', 'SDT']
        };

        if (filters.search && filters.search.trim() !== '') {
            const keyword = filters.search.trim();
            userInclude.where = {
                [Op.or]: [
                    { Hoten: { [Op.like]: `%${keyword}%` } },
                    { email: { [Op.like]: `%${keyword}%` } },
                    { SDT: { [Op.like]: `%${keyword}%` } }
                ]
            };
            userInclude.required = true;
        }

        const { count, rows } = await db.TestSubmission.findAndCountAll({
            where: baseWhere,
            include: [
                {
                    model: db.Test,
                    as: 'Test',
                    attributes: ['id', 'Tieude', 'jobPostingId', 'Tongdiem'],
                    include: [{
                        model: db.JobPosting,
                        as: 'JobPosting',
                        attributes: ['id', 'Tieude'],
                        include: [{
                            model: db.Company,
                            attributes: ['id', 'Tencongty']
                        }]
                    }]
                },
                userInclude,
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id', 'applicationStatusId']
                }
            ],
            order: [['updatedAt', 'DESC']],
            limit,
            offset
        });

        const totalPages = Math.ceil(count / limit);

        const [totalSubmissions, awaitingGrading, graded] = await Promise.all([
            db.TestSubmission.count({ where: { testId: testIds, Trangthai: { [Op.in]: allowedStatuses } } }),
            db.TestSubmission.count({ where: { testId: testIds, Trangthai: 'danop' } }),
            db.TestSubmission.count({ where: { testId: testIds, Trangthai: 'dacham' } })
        ]);

        return {
            EM: 'Lấy danh sách bài test đã nộp thành công!',
            EC: 0,
            DT: {
                submissions: rows.map(row => row.toJSON()),
                pagination: {
                    totalRows: count,
                    totalPages,
                    currentPage: page,
                    limit
                },
                stats: {
                    total: totalSubmissions,
                    pending: awaitingGrading,
                    graded
                },
                filterOptions: {
                    jobPostings: jobOptions
                }
            }
        };
    } catch (error) {
        console.error('Error in getTestSubmissionsForHr:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy danh sách bài test đã nộp!',
            EC: -1,
            DT: ''
        };
    }
};

// =====================================================
// COMPANY PROFILE MANAGEMENT
// =====================================================

/**
 * Get company profile for HR user
 * @param {number} userId - ID of the HR user
 * @returns {Object} Company profile data
 */
const getCompanyProfile = async (userId) => {
    try {
        // Find recruiter by userId
        const recruiter = await db.Recruiter.findOne({
            where: { userId: userId },
            attributes: ['id', 'Chucvu', 'SDT', 'companyId'],
            include: [
                {
                    model: db.User,
                    attributes: ['id', 'Hoten', 'email']
                },
                {
                    model: db.Company,
                    attributes: ['id', 'Tencongty', 'Nganhnghe', 'Quymo', 'Diachi', 'Website', 'Mota', 'Ngaythanhgia']
                }
            ]
        });

        if (!recruiter) {
            return {
                EM: 'Không tìm thấy thông tin nhà tuyển dụng!',
                EC: 1,
                DT: null
            };
        }

        if (!recruiter.Company) {
            return {
                EM: 'Không tìm thấy thông tin công ty!',
                EC: 2,
                DT: null
            };
        }

        return {
            EM: 'Lấy thông tin công ty thành công!',
            EC: 0,
            DT: {
                recruiter: {
                    id: recruiter.id,
                    Chucvu: recruiter.Chucvu,
                    SDT: recruiter.SDT,
                    Hoten: recruiter.User?.Hoten,
                    email: recruiter.User?.email
                },
                company: recruiter.Company.toJSON()
            }
        };
    } catch (error) {
        console.error('Error in getCompanyProfile:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy thông tin công ty!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Update company profile for HR user
 * @param {number} userId - ID of the HR user
 * @param {Object} companyData - Company data to update
 * @returns {Object} Update result
 */
const updateCompanyProfile = async (userId, companyData) => {
    try {
        // Find recruiter by userId
        const recruiter = await db.Recruiter.findOne({
            where: { userId: userId },
            attributes: ['id', 'companyId']
        });

        if (!recruiter) {
            return {
                EM: 'Không tìm thấy thông tin nhà tuyển dụng!',
                EC: 1,
                DT: null
            };
        }

        // Update company
        const [updatedRows] = await db.Company.update(
            {
                Tencongty: companyData.Tencongty,
                Nganhnghe: companyData.Nganhnghe,
                Quymo: companyData.Quymo,
                Diachi: companyData.Diachi,
                Website: companyData.Website,
                Mota: companyData.Mota
            },
            {
                where: { id: recruiter.companyId }
            }
        );

        if (updatedRows === 0) {
            return {
                EM: 'Không thể cập nhật thông tin công ty!',
                EC: 2,
                DT: null
            };
        }

        // Get updated company data
        const updatedCompany = await db.Company.findByPk(recruiter.companyId);

        return {
            EM: 'Cập nhật thông tin công ty thành công!',
            EC: 0,
            DT: updatedCompany
        };
    } catch (error) {
        console.error('Error in updateCompanyProfile:', error);
        return {
            EM: 'Có lỗi xảy ra khi cập nhật thông tin công ty!',
            EC: -1,
            DT: null
        };
    }
};

export default {
    getDashboardData,
    getMyJobPostings,
    getJobPostingDetailForHr,
    deleteJobPostingForHr,
    createJobPostingForHr,
    updateJobPostingForHr,
    getMyCompaniesForHr,
    getActiveJobPostingsForHr,
    getJobApplicationsForHr,
    getApplicationStatistics,
    getApplicationDetail,
    updateApplicationStatus,
    getCompanyProfile,
    updateCompanyProfile,
    getTestSubmissionsForHr
};
