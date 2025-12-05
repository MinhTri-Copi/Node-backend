require('dotenv').config(); // cau nay khai bao de su dung file .env



const cors = (app) => {
    app.use(function(req, res, next) {
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', process.env.REACT_URL || 'http://localhost:3000');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
            res.setHeader('Access-Control-Allow-Credentials', true);
            res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
            return res.status(200).end();
        }
        
        // Handle actual requests
        res.setHeader('Access-Control-Allow-Origin', process.env.REACT_URL || 'http://localhost:3000');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', true);
        next();
    });
}


export default cors;


