import loginRegisterService from '../service/loginRegisterService';

// Handle login
const handleLogin = async (req, res) => {
    try {
        let email = req.body.email;
        let password = req.body.password;

        // Validate input
        if (!email || !password) {
            return res.status(200).json({
                EM: 'Thiếu tham số bắt buộc!',
                EC: 1,
                DT: ''
            });
        }

        let data = await loginRegisterService.handleUserLogin(email, password);

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

// Handle register
const handleRegister = async (req, res) => {
    try {
        let data = await loginRegisterService.handleUserRegister(req.body);
        
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
    handleLogin,
    handleRegister
};
