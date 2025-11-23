import recordService from '../service/recordService';

// Get all records of logged-in user
const getMyRecords = async (req, res) => {
    try {
        // Get userId from request body/query (trong thực tế sẽ lấy từ JWT token)
        let userId = req.query.userId || req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin user!',
                EC: 1,
                DT: ''
            });
        }

        let data = await recordService.getRecordsByUserId(userId);

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

// Get record by ID
const getRecordById = async (req, res) => {
    try {
        let id = req.params.id;
        let userId = req.query.userId || req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin user!',
                EC: 1,
                DT: ''
            });
        }

        let data = await recordService.getRecordById(id, userId);

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

// Create new record
const createRecord = async (req, res) => {
    try {
        let data = await recordService.createRecord(req.body);

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

// Update record
const updateRecord = async (req, res) => {
    try {
        let id = req.params.id;
        let userId = req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin user!',
                EC: 1,
                DT: ''
            });
        }

        let data = await recordService.updateRecord(id, userId, req.body);

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

// Delete record
const deleteRecord = async (req, res) => {
    try {
        let id = req.params.id;
        let userId = req.body.userId;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin user!',
                EC: 1,
                DT: ''
            });
        }

        let data = await recordService.deleteRecord(id, userId);

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

// Upload CV file
const uploadCV = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                EM: 'Vui lòng chọn file!',
                EC: 1,
                DT: ''
            });
        }

        // Return file path
        let filePath = `/uploads/cv/${req.file.filename}`;

        return res.status(200).json({
            EM: 'Upload file thành công!',
            EC: 0,
            DT: {
                fileName: req.file.filename,
                filePath: filePath,
                fileUrl: `http://localhost:8082${filePath}`
            }
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            EM: 'Lỗi khi upload file!',
            EC: -1,
            DT: ''
        });
    }
};

module.exports = {
    getMyRecords,
    getRecordById,
    createRecord,
    updateRecord,
    deleteRecord,
    uploadCV
};

