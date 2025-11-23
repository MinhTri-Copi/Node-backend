import companyService from '../service/companyService';

// Get list companies with pagination
const getListCompany = async (req, res) => {
    try {
        let page = req.query.page || 1;
        let limit = req.query.limit || 10;

        let data = await companyService.getListCompany(+page, +limit);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Get company by ID
const getCompanyById = async (req, res) => {
    try {
        let id = req.params.id;

        let data = await companyService.getCompanyById(id);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

// Search companies
const searchCompany = async (req, res) => {
    try {
        let keyword = req.query.keyword || '';
        let page = req.query.page || 1;
        let limit = req.query.limit || 10;

        let data = await companyService.searchCompany(keyword, +page, +limit);

        return res.status(200).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        });
    }
};

module.exports = {
    getListCompany,
    getCompanyById,
    searchCompany
};

