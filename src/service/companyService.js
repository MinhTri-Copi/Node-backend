import db from '../models/index';

// Get list of companies with pagination
const getListCompany = async (page, limit) => {
    try {
        let offset = (page - 1) * limit;

        const { count, rows } = await db.Company.findAndCountAll({
            offset: offset,
            limit: limit,
            order: [['Ngaythanhgia', 'DESC']],
            raw: true,
        });

        let totalPages = Math.ceil(count / limit);

        return {
            EM: 'Lấy danh sách công ty thành công!',
            EC: 0,
            DT: {
                totalRows: count,
                totalPages: totalPages,
                companies: rows
            }
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy danh sách công ty!',
            EC: -1,
            DT: ''
        };
    }
};

// Get company by ID
const getCompanyById = async (id) => {
    try {
        if (!id) {
            return {
                EM: 'ID công ty không hợp lệ!',
                EC: 1,
                DT: ''
            };
        }

        let company = await db.Company.findOne({
            where: { id: id },
            raw: true,
        });

        if (!company) {
            return {
                EM: 'Không tìm thấy công ty!',
                EC: 2,
                DT: ''
            };
        }

        return {
            EM: 'Lấy thông tin công ty thành công!',
            EC: 0,
            DT: company
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi lấy thông tin công ty!',
            EC: -1,
            DT: ''
        };
    }
};

// Search companies by name or industry
const searchCompany = async (keyword, page, limit) => {
    try {
        let offset = (page - 1) * limit;
        
        let whereClause = {};
        if (keyword) {
            whereClause = {
                [db.Sequelize.Op.or]: [
                    { Tencongty: { [db.Sequelize.Op.like]: `%${keyword}%` } },
                    { Nganhnghe: { [db.Sequelize.Op.like]: `%${keyword}%` } },
                    { Diachi: { [db.Sequelize.Op.like]: `%${keyword}%` } }
                ]
            };
        }

        const { count, rows } = await db.Company.findAndCountAll({
            where: whereClause,
            offset: offset,
            limit: limit,
            order: [['Ngaythanhgia', 'DESC']],
            raw: true,
        });

        let totalPages = Math.ceil(count / limit);

        return {
            EM: 'Tìm kiếm công ty thành công!',
            EC: 0,
            DT: {
                totalRows: count,
                totalPages: totalPages,
                companies: rows
            }
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi khi tìm kiếm công ty!',
            EC: -1,
            DT: ''
        };
    }
};

module.exports = {
    getListCompany,
    getCompanyById,
    searchCompany
};

