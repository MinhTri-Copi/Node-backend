import mysql from "mysql2/promise";
require('dotenv').config();
const { Sequelize } = require('sequelize');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10, // Số kết nối tối đa
    queueLimit: 0
});


const sequelize = new Sequelize('jwt', 'root', null, {
    host: 'localhost',
    dialect: 'mysql'
});

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('>>>Connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }

}

const testConnectionpool = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Kết nối database MySQL thành công!');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Lỗi kết nối database:', error.message);
        return false;
    }
};


export  {
    pool,
    testConnection,
    testConnectionpool,
};