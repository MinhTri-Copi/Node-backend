import express from "express";

/**
 * 
 * @param {*} app - express app
 *app.use(express.static('public')) se cho phep trinh duyet truy cap cac file tinh trong thu muc public
 *app.set("view engine", "ejs"); se dung HTML thong qua Engine EJS
 *app.set("views", "./src/views"); tat ca nhung view  se nam trong ./src/views
 */
 const configViewEngine = (app) => {
    app.use(express.static('./src/public'))
    app.set("view engine", "ejs");  
    app.set("views", "./src/views");
}
 
export default configViewEngine;    