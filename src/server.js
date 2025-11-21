import express from 'express';
import configViewEngine from './config/viewEngine.js';
import initWebRoutes from './routes/web';
import { testConnection ,testConnectionpool} from './config/connectDB.js';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
require('dotenv').config(); 

const app = express();

//connect to React
app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', process.env.REACT_URL);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});
//co

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