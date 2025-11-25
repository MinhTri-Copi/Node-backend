import db from '../models/index';

// Get list of job postings with pagination and filters
const getListJobPosting = async (page, limit, filters = {}) => {
    try {
        let offset = (page - 1) * limit;
        
        // Build where clause based on filters
        let whereClause = {
            Trangthai: 1 // Only active jobs
        };

        // Filter by location
        if (filters.location) {
            whereClause.Diadiem = {
                [db.Sequelize.Op.like]: `%${filters.location}%`
            };
        }

        // Filter by experience
        if (filters.experience) {
            whereClause.Kinhnghiem = {
                [db.Sequelize.Op.like]: `%${filters.experience}%`
            };
        }

        // Filter by salary range
        if (filters.minSalary) {
            whereClause.Luongtoithieu = {
                [db.Sequelize.Op.gte]: filters.minSalary
            };
        }

        // Search by keyword (title or description)
        if (filters.keyword) {
            whereClause[db.Sequelize.Op.or] = [
                { Tieude: { [db.Sequelize.Op.like]: `%${filters.keyword}%` } },
                { Mota: { [db.Sequelize.Op.like]: `%${filters.keyword}%` } }
            ];
        }

        const { count, rows } = await db.JobPosting.findAndCountAll({
            where: whereClause,
            offset: offset,
            limit: limit,
            order: [['Ngaydang', 'DESC']],
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
                    model: db.Recruiter,
                    attributes: ['id', 'Chucvu', 'SDT'],
                    include: [{
                        model: db.User,
                        attributes: ['id', 'Hoten', 'email']
                    }]
                }
            ],
            distinct: true
        });

        // Get majors for each job posting
        const jobsWithMajors = await Promise.all(rows.map(async (job) => {
            const jobData = job.toJSON();
            
            // Get majors through MajorJobPosting
            const majors = await db.MajorJobPosting.findAll({
                where: { jobPostingId: job.id },
                include: [{
                    model: db.Major,
                    attributes: ['id', 'TenHinhThuc']
                }],
                raw: true,
                nest: true
            });

            jobData.majors = majors.map(m => m.Major);
            return jobData;
        }));

        let totalPages = Math.ceil(count / limit);

        return {
            EM: 'Lấy danh sách tin tuyển dụng thành công!',
            EC: 0,
            DT: {
                totalRows: count,
                totalPages: totalPages,
                jobs: jobsWithMajors
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

// Get job posting by ID with full details
const getJobPostingById = async (id) => {
    try {
        if (!id) {
            return {
                EM: 'ID tin tuyển dụng không hợp lệ!',
                EC: 1,
                DT: ''
            };
        }

        let job = await db.JobPosting.findOne({
            where: { id: id },
            include: [
                {
                    model: db.Company,
                    attributes: ['id', 'Tencongty', 'Nganhnghe', 'Quymo', 'Diachi', 'Website', 'Mota']
                },
                {
                    model: db.Format,
                    attributes: ['id', 'TenHinhThuc']
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
                EM: 'Không tìm thấy tin tuyển dụng!',
                EC: 2,
                DT: ''
            };
        }

        const jobData = job.toJSON();

        // Get majors
        const majors = await db.MajorJobPosting.findAll({
            where: { jobPostingId: id },
            include: [{
                model: db.Major,
                attributes: ['id', 'TenHinhThuc']
            }],
            raw: true,
            nest: true
        });

        jobData.majors = majors.map(m => m.Major);

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

// Create new job posting
const createJobPosting = async (data) => {
    try {
        // Validate input
        if (!data.Tieude || !data.companyId || !data.recruiterId) {
            return {
                EM: 'Vui lòng điền đầy đủ thông tin!',
                EC: 1,
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
            Trangthai: data.Trangthai || 1,
            Ngaydang: new Date(),
            Ngayhethan: data.Ngayhethan,
            companyId: data.companyId,
            recruiterId: data.recruiterId,
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

// Update job posting
const updateJobPosting = async (id, data) => {
    try {
        if (!id) {
            return {
                EM: 'ID tin tuyển dụng không hợp lệ!',
                EC: 1,
                DT: ''
            };
        }

        let job = await db.JobPosting.findOne({ where: { id: id } });

        if (!job) {
            return {
                EM: 'Không tìm thấy tin tuyển dụng!',
                EC: 2,
                DT: ''
            };
        }

        // Update job posting
        await db.JobPosting.update(
            {
                Tieude: data.Tieude || job.Tieude,
                Mota: data.Mota || job.Mota,
                Diadiem: data.Diadiem || job.Diadiem,
                Luongtoithieu: data.Luongtoithieu !== undefined ? data.Luongtoithieu : job.Luongtoithieu,
                Luongtoida: data.Luongtoida !== undefined ? data.Luongtoida : job.Luongtoida,
                Kinhnghiem: data.Kinhnghiem || job.Kinhnghiem,
                Trangthai: data.Trangthai !== undefined ? data.Trangthai : job.Trangthai,
                Ngayhethan: data.Ngayhethan || job.Ngayhethan,
                formatId: data.formatId || job.formatId
            },
            { where: { id: id } }
        );

        // Update majors if provided
        if (data.majorIds) {
            // Delete old majors
            await db.MajorJobPosting.destroy({ where: { jobPostingId: id } });
            
            // Add new majors
            if (data.majorIds.length > 0) {
                const majorJobPostings = data.majorIds.map(majorId => ({
                    majorId: majorId,
                    jobPostingId: id
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

// Delete job posting
const deleteJobPosting = async (id) => {
    try {
        if (!id) {
            return {
                EM: 'ID tin tuyển dụng không hợp lệ!',
                EC: 1,
                DT: ''
            };
        }

        let job = await db.JobPosting.findOne({ where: { id: id } });

        if (!job) {
            return {
                EM: 'Không tìm thấy tin tuyển dụng!',
                EC: 2,
                DT: ''
            };
        }

        // Delete related majors first
        await db.MajorJobPosting.destroy({ where: { jobPostingId: id } });
        
        // Delete job posting
        await db.JobPosting.destroy({ where: { id: id } });

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

export default {
    getListJobPosting,
    getJobPostingById,
    createJobPosting,
    updateJobPosting,
    deleteJobPosting
};

