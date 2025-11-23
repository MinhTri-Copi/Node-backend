import db from '../models/index';

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
            order: [['Ngaytao', 'DESC']],
            raw: true
        });

        return {
            EM: 'Lấy danh sách hồ sơ thành công!',
            EC: 0,
            DT: records
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

        // Create new record
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

