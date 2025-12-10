import express from 'express';
import configViewEngine from './config/viewEngine.js';
import initWebRoutes from './routes/web';
import { testConnection ,testConnectionpool} from './config/connectDB.js';
import bodyParser from 'body-parser';
import cors from './config/cors';
import path from 'path';
import { startHumanRetrainScheduler } from './cron/retrainHumanModel.js';
import { startExpireTestScheduler } from './cron/expireTests.js';
require('dotenv').config(); 

const app = express();

//connect to ReactS
cors(app);
//body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

//khai bao view engine
configViewEngine(app);
//Khai bao  initWebRoutes
initWebRoutes(app);

const PORT = process.env.PORT || 8082;



const  testProject = async (app) => {
    await testConnection();
    app.listen(PORT, () => {
        console.log(">>> Project is running on port: " + PORT);
    });
};


    testProject(app);

// Khởi động auto-retrain nếu bật qua ENV
if (process.env.AUTO_RETRAIN_ENABLED === 'true') {
    const threshold = parseInt(process.env.AUTO_RETRAIN_THRESHOLD || '200', 10);
    const intervalMinutes = parseInt(process.env.AUTO_RETRAIN_INTERVAL_MIN || '60', 10);
    startHumanRetrainScheduler({ threshold, intervalMinutes });
}

// Tự động tắt các bài test đã hết hạn (mặc định 10 phút/lần, đổi bằng EXPIRE_TEST_INTERVAL_MIN)
const expireInterval = parseInt(process.env.EXPIRE_TEST_INTERVAL_MIN || '10', 10);
startExpireTestScheduler(expireInterval);