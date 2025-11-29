const express = require("express");
const bodyParser = require("body-parser");
const db = require("./db");
const app = express();

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
