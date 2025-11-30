import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load .env file (dotenv.config() will automatically find .env in project root)
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-12345';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days default

// Log JWT_SECRET status (without exposing the actual secret)
console.log('JWT_SECRET loaded:', JWT_SECRET ? 'YES (length: ' + JWT_SECRET.length + ')' : 'NO - using default');


/**
 * Generate JWT token for user
 * @param {Object} user - User object with id, email, roleId
 * @returns {String} JWT token
 */
const generateToken = (user) => {
    try {
        const payload = {
            id: user.id,
            email: user.email,
            roleId: user.roleId,
            Hoten: user.Hoten || user.Hoten
        };

        const token = jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN
        });

        return token;
    } catch (error) {
        console.error('Error generating JWT token:', error);
        throw error;
    }
};

/**
 * Verify JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
    try {
        // Log for debugging
        console.log('Verifying token with JWT_SECRET:', JWT_SECRET ? 'SET' : 'NOT SET');
        
        const decoded = jwt.verify(token, JWT_SECRET);
        return {
            valid: true,
            decoded: decoded
        };
    } catch (error) {
        console.error('JWT Verification Error:', error.name, error.message);
        if (error.name === 'TokenExpiredError') {
            return {
                valid: false,
                error: 'Token đã hết hạn',
                expired: true
            };
        } else if (error.name === 'JsonWebTokenError') {
            return {
                valid: false,
                error: `Token không hợp lệ: ${error.message}`,
                invalid: true
            };
        } else {
            return {
                valid: false,
                error: `Lỗi xác thực token: ${error.message}`,
                errorDetails: error.message
            };
        }
    }
};

/**
 * Decode token without verification (for debugging)
 * @param {String} token - JWT token
 * @returns {Object} Decoded payload
 */
const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
};

export default {
    generateToken,
    verifyToken,
    decodeToken
};

