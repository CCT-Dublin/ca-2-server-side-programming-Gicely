const express = require("express");
const bodyParser = require("body-parser");
const db = require("./db");
const app = express();
const fs = require("fs");
const csv = require("csv-parser");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Check port middleware
app.use((req, res, next) => {
    if (!app) return res.status(500).send("Server not running");
    next();
});

// Basic CSP header
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'");
    next();
});

app.listen(3000, () => console.log("Server running on port 3000"));

function validateRow(row, lineNumber) {
    if (!row.first_name || row.first_name.length > 20) return `Error in row ${lineNumber}`;
    return null;
}

app.get("/upload-csv", (req, res) => {
    const validRows = [];
    let line = 1;

    fs.createReadStream("/mnt/data/person_info.csv")
        .pipe(csv())
        .on("data", (row) => {
            const error = validateRow(row, line);
            if (error) console.log(error);
            else validRows.push(row);
            line++;
        })
        .on("end", () => {
            validRows.forEach(r => {
                db.query(
                    "INSERT INTO mysql_table (first_name, second_name, email, phone, eircode) VALUES (?,?,?,?,?)",
                    [r.first_name, r.second_name, r.email, r.phone, r.eircode]
                );
            });
            res.send("CSV processed");
        });
});
