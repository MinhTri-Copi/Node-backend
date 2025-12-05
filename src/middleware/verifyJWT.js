import jwtService from '../service/jwtService';

/**
 * Middleware to verify JWT token
 * Extracts token from Authorization header or query params
 */
const verifyJWT = (req, res, next) => {
    try {
        // Get token from Authorization header or query params
        let token = null;

        // Check Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7); // Remove 'Bearer ' prefix
        }

        // If no token in header, check query params
        if (!token && req.query.token) {
            token = req.query.token;
        }

        // If still no token, check body (only if body exists)
        if (!token && req.body && req.body.token) {
            token = req.body.token;
        }

        if (!token) {
            return res.status(401).json({
                EM: 'Không tìm thấy token xác thực!',
                EC: 401,
                DT: null
            });
        }

        // Verify token
        const verificationResult = jwtService.verifyToken(token);

        if (!verificationResult.valid) {
            console.error('Token verification failed:', verificationResult);
            return res.status(401).json({
                EM: verificationResult.error || 'Token không hợp lệ!',
                EC: 401,
                DT: null
            });
        }

        // Attach user info to request
        req.user = verificationResult.decoded;
        req.token = token;

        next();
    } catch (error) {
        console.error('Error in verifyJWT middleware:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({
            EM: `Lỗi xác thực token: ${error.message}`,
            EC: 500,
            DT: null
        });
    }
};

/**
 * Optional JWT verification - doesn't fail if no token
 * Useful for endpoints that work with or without auth
 */
const optionalJWT = (req, res, next) => {
    try {
        let token = null;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (token) {
            const verificationResult = jwtService.verifyToken(token);
            if (verificationResult.valid) {
                req.user = verificationResult.decoded;
                req.token = token;
            }
        }

        next();
    } catch (error) {
        // Continue even if verification fails
        next();
    }
};

/**
 * Middleware to check if user has specific role
 * Must be used after verifyJWT
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                EM: 'Chưa xác thực!',
                EC: 401,
                DT: null
            });
        }

        const userRoleId = req.user.roleId;
        
        if (!allowedRoles.includes(userRoleId)) {
            return res.status(403).json({
                EM: 'Bạn không có quyền truy cập!',
                EC: 403,
                DT: null
            });
        }

        next();
    };
};

export default {
    verifyJWT,
    optionalJWT,
    requireRole
};

