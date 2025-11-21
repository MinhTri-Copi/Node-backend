import {pool} from '../config/connectDB.js';
import db from  '../models/index.js';
const getUser = async (req,res) => {
   //check mooi quan he :
   let role = await db.Role.findAll({
    where: {id:1},
        include: {model: db.User},
        raw: true,
        nest: true
   });
   console.log(">>>>check role:" ,role);
};


export default {
    getUser,
};  