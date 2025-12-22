import db from '../models/index';
import path from 'path';

// Get all records of a user
const getRecordsByUserId = async (userId) => {
    try {
        if (!userId) {
            return {
                EM: 'User ID không hợp lệ!',
                EC: 1,
                DT: ''
            };
        }

        let records = await db.Record.findAll({
            where: { userId: userId },
            include: [{
                model: db.JobApplication,
                attributes: ['id'],
                required: false
            }],
            order: [['Ngaytao', 'DESC']]
        });

        // Transform records to include application count
        const recordsWithStats = records.map(record => {
            const recordData = record.toJSON();
            recordData.applicationCount = recordData.JobApplications ? recordData.JobApplications.length : 0;
            delete recordData.JobApplications; // Remove the array, we only need count
            return recordData;
        });

        return {
            EM: 'Lấy danh sách hồ sơ thành công!',
            EC: 0,
            DT: recordsWithStats
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy danh sách hồ sơ!',
            EC: -1,
            DT: ''
        };
    }
};

// Get record by ID
const getRecordById = async (id, userId) => {
    try {
        if (!id) {
            return {
                EM: 'ID hồ sơ không hợp lệ!',
                EC: 1,
                DT: ''
            };
        }

        let record = await db.Record.findOne({
            where: { 
                id: id,
                userId: userId // Ensure user can only access their own records
            },
            raw: true
        });

        if (!record) {
            return {
                EM: 'Không tìm thấy hồ sơ!',
                EC: 2,
                DT: ''
            };
        }

        return {
            EM: 'Lấy thông tin hồ sơ thành công!',
            EC: 0,
            DT: record
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy thông tin hồ sơ!',
            EC: -1,
            DT: ''
        };
    }
};

// Create new record
const createRecord = async (data) => {
    try {
        // Validate input
        if (!data.Tieude || !data.userId) {
            return {
                EM: 'Vui lòng điền đầy đủ thông tin!',
                EC: 1,
                DT: ''
            };
        }

        // Nếu có File_url, kiểm tra xem đã có record nào với File_url này chưa
        // (để tránh tạo record trùng khi upload CV đã tạo record trước đó)
        if (data.File_url) {
            // Lấy filename từ File_url để so sánh (xử lý cả absolute và relative path)
            const fileName = path.basename(data.File_url);
            
            // Tìm record có cùng filename (so sánh filename vì có thể có absolute/relative path khác nhau)
            const allUserRecords = await db.Record.findAll({
                where: {
                    userId: data.userId
                },
                order: [['createdAt', 'DESC']]
            });

            // Tìm record có filename trùng
            const existingRecord = allUserRecords.find(record => {
                if (!record.File_url) return false;
                const recordFileName = path.basename(record.File_url);
                return recordFileName === fileName;
            });

            if (existingRecord) {
                // Cập nhật record đã tồn tại với Tieude mới
                // Giữ nguyên cvText, fileHash, extractionStatus, extractedAt nếu đã có
                // Đảm bảo File_url là relative path (chuẩn hóa)
                const fileUrlToSave = data.File_url.startsWith('/') 
                    ? data.File_url 
                    : (existingRecord.File_url.startsWith('/') ? existingRecord.File_url : data.File_url);
                
                await db.Record.update(
                    {
                        Tieude: data.Tieude,
                        File_url: fileUrlToSave
                    },
                    {
                        where: { id: existingRecord.id }
                    }
                );

                // Lấy record đã cập nhật
                const updatedRecord = await db.Record.findOne({
                    where: { id: existingRecord.id },
                    raw: true
                });

                return {
                    EM: 'Cập nhật hồ sơ thành công!',
                    EC: 0,
                    DT: updatedRecord
                };
            }
        }

        // Nếu không có File_url hoặc không tìm thấy record trùng → tạo mới
        let newRecord = await db.Record.create({
            Tieude: data.Tieude,
            File_url: data.File_url || null,
            Ngaytao: new Date(),
            userId: data.userId,
            Manguoidung: data.userId
        });

        return {
            EM: 'Tạo hồ sơ thành công!',
            EC: 0,
            DT: newRecord
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi tạo hồ sơ!',
            EC: -1,
            DT: ''
        };
    }
};

// Update record
const updateRecord = async (id, userId, data) => {
    try {
        if (!id) {
            return {
                EM: 'ID hồ sơ không hợp lệ!',
                EC: 1,
                DT: ''
            };
        }

        // Check if record exists and belongs to user
        let record = await db.Record.findOne({
            where: { 
                id: id,
                userId: userId
            }
        });

        if (!record) {
            return {
                EM: 'Không tìm thấy hồ sơ hoặc bạn không có quyền chỉnh sửa!',
                EC: 2,
                DT: ''
            };
        }

        // Update record
        await db.Record.update(
            {
                Tieude: data.Tieude || record.Tieude,
                File_url: data.File_url !== undefined ? data.File_url : record.File_url
            },
            {
                where: { id: id }
            }
        );

        // Get updated record
        let updatedRecord = await db.Record.findOne({
            where: { id: id },
            raw: true
        });

        return {
            EM: 'Cập nhật hồ sơ thành công!',
            EC: 0,
            DT: updatedRecord
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi cập nhật hồ sơ!',
            EC: -1,
            DT: ''
        };
    }
};

// Delete record
const deleteRecord = async (id, userId) => {
    try {
        if (!id) {
            return {
                EM: 'ID hồ sơ không hợp lệ!',
                EC: 1,
                DT: ''
            };
        }

        // Check if record exists and belongs to user
        let record = await db.Record.findOne({
            where: { 
                id: id,
                userId: userId
            }
        });

        if (!record) {
            return {
                EM: 'Không tìm thấy hồ sơ hoặc bạn không có quyền xóa!',
                EC: 2,
                DT: ''
            };
        }

        await db.Record.destroy({
            where: { id: id }
        });

        return {
            EM: 'Xóa hồ sơ thành công!',
            EC: 0,
            DT: ''
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi xóa hồ sơ!',
            EC: -1,
            DT: ''
        };
    }
};

module.exports = {
    getRecordsByUserId,
    getRecordById,
    createRecord,
    updateRecord,
    deleteRecord
};

