import express from 'express';
import helloController from '../controller/helloController';

const router = express.Router();



const initWebRoutes = (app) => {
    app.get("/", helloController.printHello);

    app.get("/hello", helloController.getHelloPage);
    app.use("/", router);
};

export default initWebRoutes; 