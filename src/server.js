import express from 'express';
import configViewEngine from './config/viewEngine.js';
import initWebRoutes from './routes/web';
import { testConnection ,testConnectionpool} from './config/connectDB.js';
import bodyParser from 'body-parser';
import cors from './config/cors';
require('dotenv').config(); 

const app = express();

//connect to ReactS
cors(app);
//body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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