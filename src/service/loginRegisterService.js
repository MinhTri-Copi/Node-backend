import db from '../models/index';
import bcrypt from 'bcryptjs';

const salt = bcrypt.genSaltSync(10);

// Hash password
const hashUserPassword = (password) => {
    try {
        return bcrypt.hashSync(password, salt);
    } catch (e) {
        console.log(e);
        return null;
    }
};

// Check password
const checkPassword = (inputPassword, hashPassword) => {
    try {
        return bcrypt.compareSync(inputPassword, hashPassword);
    } catch (e) {
        console.log(e);
        return false;
    }
};

// Login service
const handleUserLogin = async (email, password) => {
    try {
        // Validate input
        if (!email || !password) {
            return {
                EM: 'Email và mật khẩu không được để trống!',
                EC: 1,
                DT: ''
            };
        }

        // Check if user exists
        let isExist = await checkUserEmail(email);
        
        if (isExist) {
            // User exists, check password
            let user = await db.User.findOne({
                where: { email: email },
                attributes: ['id', 'email', 'matKhau', 'Hoten', 'roleId'],
                include: [
                    {
                        model: db.Role,
                        attributes: ['id', 'TenVaiTro']
                    }
                ],
                raw: true,
                nest: true
            });

            if (user) {
                // Compare password
                let check = checkPassword(password, user.matKhau);
                if (check) {
                    // Update last login time
                    await db.User.update(
                        { lanDangNhapCuoiCung: new Date().toISOString() },
                        { where: { id: user.id } }
                    );

                    // Remove password from response
                    delete user.matKhau;
                    
                    return {
                        EM: 'Đăng nhập thành công!',
                        EC: 0,
                        DT: user
                    };
                } else {
                    return {
                        EM: 'Mật khẩu không đúng!',
                        EC: 3,
                        DT: ''
                    };
                }
            } else {
                return {
                    EM: 'Người dùng không tồn tại!',
                    EC: 2,
                    DT: ''
                };
            }
        } else {
            return {
                EM: 'Email không tồn tại trong hệ thống!',
                EC: 2,
                DT: ''
            };
        }
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        };
    }
};

// Check if email exists
const checkUserEmail = async (userEmail) => {
    try {
        let user = await db.User.findOne({
            where: { email: userEmail }
        });
        return user ? true : false;
    } catch (e) {
        console.log(e);
        return false;
    }
};

// Register service
const handleUserRegister = async (data) => {
    try {
        // Validate input
        if (!data.email || !data.matKhau || !data.Hoten) {
            return {
                EM: 'Vui lòng điền đầy đủ thông tin!',
                EC: 1,
                DT: ''
            };
        }

        // Check if email already exists
        let check = await checkUserEmail(data.email);
        if (check) {
            return {
                EM: 'Email đã tồn tại trong hệ thống!',
                EC: 2,
                DT: ''
            };
        }

        // Hash password
        let hashPasswordFromBcrypt = hashUserPassword(data.matKhau);
        
        if (!hashPasswordFromBcrypt) {
            return {
                EM: 'Lỗi khi mã hóa mật khẩu!',
                EC: -1,
                DT: ''
            };
        }

        // Create new user
        await db.User.create({
            email: data.email,
            matKhau: hashPasswordFromBcrypt,
            Hoten: data.Hoten,
            roleId: data.roleId || 3, // Default role = 3 (candidate)
            ngayTaoTaiKhoan: new Date().toISOString(),
            lanDangNhapCuoiCung: null
        });

        return {
            EM: 'Đăng ký thành công!',
            EC: 0,
            DT: ''
        };
    } catch (e) {
        console.log(e);
        return {
            EM: 'Lỗi từ server!',
            EC: -1,
            DT: ''
        };
    }
};

module.exports = {
    handleUserLogin,
    handleUserRegister,
    hashUserPassword,
    checkUserEmail
};
