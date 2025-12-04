//import mysql
const mysql = require("mysql2");

//create the connection configuration - change host/user/password/database to match MySQL setup
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "assignment_db"
});

//connection mysql server
db.connect((err) => {
    if (err) console.log("DB ERROR:", err);
    else console.log("Connected to MySQL");
});

//export the connection so other files can use it
module.exports = db;