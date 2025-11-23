import express from 'express';
import helloController from '../controller/helloController';
import loginRegisterController from '../controller/loginRegisterController';

const router = express.Router();



const initWebRoutes = (app) => {
    app.get("/", helloController.printHello);
    app.get("/hello", helloController.getHelloPage);
    
    // API Login & Register
    app.post("/api/login", loginRegisterController.handleLogin);
    app.post("/api/register", loginRegisterController.handleRegister);
    
    app.use("/", router);
};

export default initWebRoutes; 