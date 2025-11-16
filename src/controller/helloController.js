const e = require("express");

 import userService from '../service/userService.js';

 
const getHelloPage = (req,res) => {
    return res.render('hello.ejs');

};
const printHello = async (req,res) => {
    const user = await userService.getUser();
    console.log(">>>>>>user: ", user);
    return res.send("Hello word");
};

module.exports = {
    getHelloPage,
    printHello,
}