import questionBankService from '../service/questionBankService';

/**
 * Upload question bank file
 */
const uploadQuestionBank = async (req, res) => {
    try {
        const { userId } = req.body;
        const file = req.file;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const data = await questionBankService.uploadQuestionBank(
            parseInt(userId),
            file,
            req.body
        );

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in uploadQuestionBank controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get all question banks for HR
 */
const getQuestionBanks = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin người dùng!',
                EC: 1,
                DT: null
            });
        }

        const data = await questionBankService.getQuestionBanks(parseInt(userId));

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getQuestionBanks controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Get question bank detail
 */
const getQuestionBankDetail = async (req, res) => {
    try {
        const { userId } = req.query;
        const { bankId } = req.params;

        if (!userId || !bankId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await questionBankService.getQuestionBankDetail(
            parseInt(userId),
            parseInt(bankId)
        );

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in getQuestionBankDetail controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Delete question bank
 */
const deleteQuestionBank = async (req, res) => {
    try {
        const { userId } = req.body;
        const { bankId } = req.params;

        if (!userId || !bankId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await questionBankService.deleteQuestionBank(
            parseInt(userId),
            parseInt(bankId)
        );

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in deleteQuestionBank controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

/**
 * Update question bank item
 */
const updateQuestionBankItem = async (req, res) => {
    try {
        const { userId } = req.body;
        const { itemId } = req.params;
        const updateData = req.body;

        if (!userId || !itemId) {
            return res.status(400).json({
                EM: 'Thiếu thông tin bắt buộc!',
                EC: 1,
                DT: null
            });
        }

        const data = await questionBankService.updateQuestionBankItem(
            parseInt(userId),
            parseInt(itemId),
            updateData
        );

        return res.status(data.EC === 0 ? 200 : 400).json({
            EM: data.EM,
            EC: data.EC,
            DT: data.DT
        });
    } catch (error) {
        console.error('Error in updateQuestionBankItem controller:', error);
        return res.status(500).json({
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: null
        });
    }
};

export default {
    uploadQuestionBank,
    getQuestionBanks,
    getQuestionBankDetail,
    deleteQuestionBank,
    updateQuestionBankItem
};

