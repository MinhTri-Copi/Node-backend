import db from '../models/index.js';
import {pool} from '../config/connectDB.js';

const getUser = async (req,res) => {
    let user = {};
    user = await pool.query('SELECT * FROM users WHERE id = 1');
    return user;
};


export default {
    getUser,
};  