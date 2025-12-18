import db from '../models/index';
import { createOrUpdateJobPostingEmbedding } from './jobPostingEmbeddingService.js';

// Get list of job postings with pagination and filters
// QUERY FROM MajorJobPosting table
const getListJobPosting = async (page, limit, filters = {}) => {
    try {
        // Build where clause for JobPosting
        let jobPostingWhere = {
            TrangthaiId: 1 // Only active jobs (ACTIVE status)
        };

        // Filter by location
        if (filters.location) {
            jobPostingWhere.Diadiem = {
                [db.Sequelize.Op.like]: `%${filters.location}%`
            };
        }

        // Filter by experience
        if (filters.experience) {
            jobPostingWhere.Kinhnghiem = {
                [db.Sequelize.Op.like]: `%${filters.experience}%`
            };
        }

        // Filter by salary range
        if (filters.minSalary) {
            jobPostingWhere.Luongtoithieu = {
                [db.Sequelize.Op.gte]: filters.minSalary
            };
        }

        // Filter by max salary
        if (filters.maxSalary) {
            jobPostingWhere.Luongtoida = {
                [db.Sequelize.Op.lte]: filters.maxSalary
            };
        }

        // Filter by company
        if (filters.companyId) {
            jobPostingWhere.companyId = filters.companyId;
        }

        // Filter by format (hình thức làm việc)
        if (filters.formatId) {
            jobPostingWhere.formatId = filters.formatId;
        }

        // Search by keyword (title or description)
        if (filters.keyword) {
            jobPostingWhere[db.Sequelize.Op.or] = [
                { Tieude: { [db.Sequelize.Op.like]: `%${filters.keyword}%` } },
                { Mota: { [db.Sequelize.Op.like]: `%${filters.keyword}%` } }
            ];
        }

        // Build where clause for MajorJobPosting
        let majorJobPostingWhere = {};
        if (filters.majorId) {
            majorJobPostingWhere.majorId = filters.majorId;
        }

        // Query from MajorJobPosting table
        const rows = await db.MajorJobPosting.findAll({
            where: majorJobPostingWhere,
            include: [
                {
                    model: db.JobPosting,
                    where: jobPostingWhere,
                    required: true, // INNER JOIN - chỉ lấy job postings có major
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
                            include: [{
                                model: db.User,
                                attributes: ['id', 'Hoten', 'email']
                            }]
                        }
                    ]
                },
                {
                    model: db.Major,
                    attributes: ['id', 'TenNghanhNghe']
                }
            ],
            order: [[db.JobPosting, 'Ngaydang', 'DESC']]
        });

        // Group by job posting ID to avoid duplicates (vì 1 job có nhiều majors)
        const jobMap = new Map();
        
        rows.forEach(row => {
            const data = row.toJSON();
            const jobPosting = data.JobPosting;
            const major = data.Major;
            
            if (!jobMap.has(jobPosting.id)) {
                jobPosting.majors = [];
                jobMap.set(jobPosting.id, jobPosting);
            }
            
            // Add major to the job posting
            if (major) {
                jobMap.get(jobPosting.id).majors.push(major);
            }
        });

        // Convert map to array and apply pagination manually
        const allJobs = Array.from(jobMap.values());
        const totalRows = allJobs.length;
        
        // Get interview rounds count for each job posting
        const jobPostingIds = allJobs.map(job => job.id);
        const roundsCountMap = {};
        
        if (jobPostingIds.length > 0) {
            // Count rounds for each job posting in parallel
            const countPromises = jobPostingIds.map(async (jobId) => {
                const count = await db.InterviewRound.count({
                    where: {
                        jobPostingId: jobId,
                        isActive: true
                    }
                });
                return { jobId, count };
            });
            
            const counts = await Promise.all(countPromises);
            counts.forEach(({ jobId, count }) => {
                roundsCountMap[jobId] = count;
            });
        }

        // Add interview rounds count to each job
        allJobs.forEach(job => {
            job.interviewRoundsCount = roundsCountMap[job.id] || 0;
        });
        
        // Apply pagination
        let offset = (page - 1) * limit;
        const paginatedJobs = allJobs.slice(offset, offset + limit);
        const totalPages = Math.ceil(totalRows / limit);

        return {
            EM: 'Lấy danh sách tin tuyển dụng thành công!',
            EC: 0,
            DT: {
                totalRows: totalRows,
                totalPages: totalPages,
                jobs: paginatedJobs
            }
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy danh sách tin tuyển dụng!',
            EC: -1,
            DT: []
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
                attributes: ['id', 'TenNghanhNghe']
            }],
            raw: true,
            nest: true
        });

        jobData.majors = majors.map(m => m.Major);

        // Get interview rounds (active only)
        const interviewRounds = await db.InterviewRound.findAll({
            where: {
                jobPostingId: id,
                isActive: true
            },
            attributes: ['id', 'roundNumber', 'title', 'duration', 'description'],
            order: [['roundNumber', 'ASC']]
        });

        jobData.interviewRounds = interviewRounds.map(round => round.toJSON());
        jobData.interviewRoundsCount = interviewRounds.length;

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
            TrangthaiId: data.TrangthaiId || 1, // Default: ACTIVE
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

        // Pre-embed JD text (async, không block response)
        // Build JD text đầy đủ theo chuẩn DB (JobPosting + Format + Company + Majors)
        const buildJDText = async (job, majors = [], company = null, format = null) => {
            const parts = [];
            
            // 1. JobPosting fields
            if (job.Tieude) parts.push(job.Tieude);
            if (job.Mota) parts.push(job.Mota);
            if (job.Diadiem) parts.push(`Địa điểm: ${job.Diadiem}`);
            if (job.Kinhnghiem) parts.push(`Kinh nghiệm yêu cầu: ${job.Kinhnghiem}`);
            if (job.Luongtoithieu || job.Luongtoida) {
                const salaryParts = [];
                if (job.Luongtoithieu) salaryParts.push(`${(job.Luongtoithieu / 1000000).toFixed(1)} triệu`);
                if (job.Luongtoida) salaryParts.push(`${(job.Luongtoida / 1000000).toFixed(1)} triệu`);
                parts.push(`Mức lương: ${salaryParts.join(' - ')} VNĐ`);
            }
            
            // 2. Format
            if (format && format.TenHinhThuc) {
                parts.push(`Hình thức làm việc: ${format.TenHinhThuc}`);
            }
            
            // 3. Majors
            if (majors.length > 0) {
                const majorNames = majors.map(m => m.TenNghanhNghe || m).join(', ');
                parts.push(`Ngành nghề: ${majorNames}`);
            }
            
            // 4. Company
            if (company) {
                if (company.Tencongty) parts.push(`Công ty: ${company.Tencongty}`);
                if (company.Nganhnghe) parts.push(`Lĩnh vực công ty: ${company.Nganhnghe}`);
                if (company.Quymo) parts.push(`Quy mô: ${company.Quymo}`);
                if (company.Diachi) parts.push(`Địa chỉ công ty: ${company.Diachi}`);
                if (company.Mota) parts.push(`Mô tả công ty: ${company.Mota}`);
            }
            
            return parts.filter(Boolean).join('. ');
        };
        
        // Lấy thông tin đầy đủ
        let majors = [];
        if (data.majorIds && data.majorIds.length > 0) {
            majors = await db.Major.findAll({
                where: { id: data.majorIds },
                attributes: ['id', 'TenNghanhNghe']
            });
        }
        
        const company = await db.Company.findByPk(data.companyId, {
            attributes: ['id', 'Tencongty', 'Nganhnghe', 'Quymo', 'Diachi', 'Mota']
        });
        
        const format = data.formatId ? await db.Format.findByPk(data.formatId, {
            attributes: ['id', 'TenHinhThuc']
        }) : null;
        
        const jdText = await buildJDText(newJob, majors, company, format);
        
        if (jdText.trim().length > 0) {
            createOrUpdateJobPostingEmbedding(newJob.id, jdText)
                .then(result => {
                    if (result.EC === 0) {
                        console.log(`✅ Đã embed JD cho job posting ${newJob.id}`);
                    } else {
                        console.warn(`⚠️ Không thể embed JD cho job posting ${newJob.id}: ${result.EM}`);
                    }
                })
                .catch(error => {
                    console.error(`❌ Lỗi khi embed JD cho job posting ${newJob.id}:`, error);
                });
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
                TrangthaiId: data.TrangthaiId !== undefined ? data.TrangthaiId : job.TrangthaiId,
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

        // Re-embed JD text nếu có thay đổi (async, không block response)
        const updatedJob = await db.JobPosting.findByPk(id, {
            include: [
                {
                    model: db.Company,
                    as: 'Company',
                    attributes: ['id', 'Tencongty', 'Nganhnghe', 'Quymo', 'Diachi', 'Mota']
                },
                {
                    model: db.Format,
                    attributes: ['id', 'TenHinhThuc']
                },
                {
                    model: db.Major,
                    attributes: ['id', 'TenNghanhNghe'],
                    through: { attributes: [] }
                }
            ]
        });
        
        if (updatedJob) {
            // Helper function để build JD text đầy đủ theo chuẩn DB
            const buildJDText = (job) => {
                const parts = [];
                
                // 1. JobPosting fields
                if (job.Tieude) parts.push(job.Tieude);
                if (job.Mota) parts.push(job.Mota);
                if (job.Diadiem) parts.push(`Địa điểm: ${job.Diadiem}`);
                if (job.Kinhnghiem) parts.push(`Kinh nghiệm yêu cầu: ${job.Kinhnghiem}`);
                if (job.Luongtoithieu || job.Luongtoida) {
                    const salaryParts = [];
                    if (job.Luongtoithieu) salaryParts.push(`${(job.Luongtoithieu / 1000000).toFixed(1)} triệu`);
                    if (job.Luongtoida) salaryParts.push(`${(job.Luongtoida / 1000000).toFixed(1)} triệu`);
                    parts.push(`Mức lương: ${salaryParts.join(' - ')} VNĐ`);
                }
                
                // 2. Format
                if (job.Format && job.Format.TenHinhThuc) {
                    parts.push(`Hình thức làm việc: ${job.Format.TenHinhThuc}`);
                }
                
                // 3. Majors
                const majors = job.Majors || job.majors || [];
                if (majors.length > 0) {
                    const majorNames = majors.map(m => m.TenNghanhNghe).join(', ');
                    parts.push(`Ngành nghề: ${majorNames}`);
                }
                
                // 4. Company
                if (job.Company) {
                    if (job.Company.Tencongty) parts.push(`Công ty: ${job.Company.Tencongty}`);
                    if (job.Company.Nganhnghe) parts.push(`Lĩnh vực công ty: ${job.Company.Nganhnghe}`);
                    if (job.Company.Quymo) parts.push(`Quy mô: ${job.Company.Quymo}`);
                    if (job.Company.Diachi) parts.push(`Địa chỉ công ty: ${job.Company.Diachi}`);
                    if (job.Company.Mota) parts.push(`Mô tả công ty: ${job.Company.Mota}`);
                }
                
                return parts.filter(Boolean).join('. ');
            };
            
            const jdText = buildJDText(updatedJob);
            
            if (jdText.trim().length > 0) {
                createOrUpdateJobPostingEmbedding(id, jdText)
                    .then(result => {
                        if (result.EC === 0) {
                            console.log(`✅ Đã re-embed JD cho job posting ${id}`);
                        } else {
                            console.warn(`⚠️ Không thể re-embed JD cho job posting ${id}: ${result.EM}`);
                        }
                    })
                    .catch(error => {
                        console.error(`❌ Lỗi khi re-embed JD cho job posting ${id}:`, error);
                    });
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
// Chỉ cho phép xóa khi trạng thái là "Ngừng tuyển" (TrangthaiId = 2)
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

        // Chỉ cho phép xóa khi trạng thái "Ngừng tuyển" (id = 2)
        // Giả định mapping: 1 = Đang tuyển, 2 = Ngừng tuyển (theo migration)
        if (job.TrangthaiId !== 2) {
            return {
                EM: 'Chỉ được xóa tin tuyển dụng ở trạng thái "Ngừng tuyển"!',
                EC: 3,
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
        // Trường hợp bị ràng buộc khóa ngoại (đã có đơn ứng tuyển tham chiếu)
        if (
            e.name === 'SequelizeForeignKeyConstraintError' ||
            (e.parent && e.parent.code === 'ER_ROW_IS_REFERENCED_2')
        ) {
            return {
                EM: 'Tin tuyển dụng đã có đơn ứng tuyển, không thể xóa. Vui lòng xử lý/hủy các đơn liên quan trước.',
                EC: 4,
                DT: ''
            };
        }
        console.log(e);
        return {
            EM: 'Lỗi khi xóa tin tuyển dụng!',
            EC: -1,
            DT: ''
        };
    }
};

// Get all filter options (majors, formats, companies, locations, experiences)
const getFilterOptions = async () => {
    try {
        // Get all majors with job count
        const majors = await db.Major.findAll({
            attributes: [
                'id', 
                'TenNghanhNghe',
                [db.Sequelize.literal(`(
                    SELECT COUNT(DISTINCT mjp.jobPostingId) 
                    FROM MajorJobPosting mjp 
                    INNER JOIN JobPosting jp ON mjp.jobPostingId = jp.id 
                    WHERE mjp.majorId = Major.id AND jp.TrangthaiId = 1
                )`), 'jobCount']
            ],
            order: [[db.Sequelize.literal('jobCount'), 'DESC']]
        });

        // Get all formats
        const formats = await db.Format.findAll({
            attributes: ['id', 'TenHinhThuc'],
            order: [['TenHinhThuc', 'ASC']]
        });

        // Get all companies with active jobs
        const companies = await db.Company.findAll({
            attributes: [
                'id', 
                'Tencongty',
                [db.Sequelize.literal(`(
                    SELECT COUNT(*) 
                    FROM JobPosting jp 
                    WHERE jp.companyId = Company.id AND jp.TrangthaiId = 1
                )`), 'jobCount']
            ],
            having: db.Sequelize.literal('jobCount > 0'),
            order: [[db.Sequelize.literal('jobCount'), 'DESC']],
            limit: 20
        });

        // Get distinct locations from active jobs
        const locations = await db.JobPosting.findAll({
            attributes: [[db.Sequelize.fn('DISTINCT', db.Sequelize.col('Diadiem')), 'Diadiem']],
            where: { 
                TrangthaiId: 1,
                Diadiem: { [db.Sequelize.Op.ne]: null }
            },
            order: [['Diadiem', 'ASC']]
        });

        // Predefined experience levels
        const experiences = [
            { value: 'Chưa có kinh nghiệm', label: 'Chưa có kinh nghiệm' },
            { value: 'Dưới 1 năm', label: 'Dưới 1 năm' },
            { value: '1 năm', label: '1 năm' },
            { value: '2 năm', label: '2 năm' },
            { value: '3 năm', label: '3 năm' },
            { value: '4 năm', label: '4 năm' },
            { value: '5 năm', label: '5 năm' },
            { value: 'Trên 5 năm', label: 'Trên 5 năm' }
        ];

        // Predefined salary ranges
        const salaryRanges = [
            { value: '0-10', label: 'Dưới 10 triệu', min: 0, max: 10000000 },
            { value: '10-15', label: '10 - 15 triệu', min: 10000000, max: 15000000 },
            { value: '15-20', label: '15 - 20 triệu', min: 15000000, max: 20000000 },
            { value: '20-25', label: '20 - 25 triệu', min: 20000000, max: 25000000 },
            { value: '25-30', label: '25 - 30 triệu', min: 25000000, max: 30000000 },
            { value: '30-50', label: '30 - 50 triệu', min: 30000000, max: 50000000 },
            { value: '50+', label: 'Trên 50 triệu', min: 50000000, max: null }
        ];

        return {
            EM: 'Lấy danh sách bộ lọc thành công!',
            EC: 0,
            DT: {
                majors: majors.map(m => m.toJSON()),
                formats: formats.map(f => f.toJSON()),
                companies: companies.map(c => c.toJSON()),
                locations: locations.map(l => l.Diadiem).filter(l => l),
                experiences,
                salaryRanges
            }
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy danh sách bộ lọc!',
            EC: -1,
            DT: null
        };
    }
};

export default {
    getListJobPosting,
    getJobPostingById,
    createJobPosting,
    updateJobPosting,
    deleteJobPosting,
    getFilterOptions
};

