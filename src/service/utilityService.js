import db from '../models/index';

const getAllMajors = async () => {
    try {
        const majors = await db.Major.findAll({
            attributes: ['id', 'TenNghanhNghe'],
            order: [['TenNghanhNghe', 'ASC']]
        });

        return {
            EM: 'Lấy danh sách ngành nghề thành công!',
            EC: 0,
            DT: majors
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy danh sách ngành nghề!',
            EC: -1,
            DT: ''
        };
    }
};

const getAllFormats = async () => {
    try {
        const formats = await db.Format.findAll({
            attributes: ['id', 'TenHinhThuc'],
            order: [['TenHinhThuc', 'ASC']]
        });

        return {
            EM: 'Lấy danh sách hình thức làm việc thành công!',
            EC: 0,
            DT: formats
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy danh sách hình thức làm việc!',
            EC: -1,
            DT: ''
        };
    }
};

const getAllJobPostingStatuses = async () => {
    try {
        const statuses = await db.JobPostingStatus.findAll({
            attributes: ['id', 'TenTrangThai'],
            order: [['id', 'ASC']]
        });

        return {
            EM: 'Lấy danh sách trạng thái thành công!',
            EC: 0,
            DT: statuses
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy danh sách trạng thái!',
            EC: -1,
            DT: ''
        };
    }
};

export default {
    getAllMajors,
    getAllFormats,
    getAllJobPostingStatuses
};

