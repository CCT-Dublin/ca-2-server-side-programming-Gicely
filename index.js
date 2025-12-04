//imports
const express = require("express");
const bodyParser = require("body-parser"); 
const fs = require("fs");                  
const csv = require("csv-parser");         
const db = require("./db");                
const cors = require("cors");              


//app setup
const app = express();
const PORT = 3000;

//parse application/json 
app.use(bodyParser.json());

//parse application/x-www-form-urlencoded (for HTML form posts)
app.use(bodyParser.urlencoded({ extended: true }));

//optionally allow requests from other origins during development
app.use(cors());


//middleware: basic server/port check (Day 3 requirement)
app.use((req, res, next) => {
  if (!app) {
    //if for some reason the app object is missing, return an error
    return res.status(500).send("Server not running");
  }
  //proceed to next middleware / route
  next();
});

//middleware: Content Security Policy (CSP) header 
app.use((req, res, next) => {
  //only allow resources from same origin by default
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  next();
});

//helper: input cleaning / sanitization (Day 8)
function clean(input) {
  if (typeof input !== "string") return input;
  return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}


//route: POST /submit - receive data from form.html and save to DB 
app.post("/submit", (req, res) => {
  const f1 = clean(req.body.f1);
  const f2 = clean(req.body.f2);
  const email = clean(req.body.email);
  const phone = clean(req.body.phone);
  const eir = clean(req.body.eir);

  //very basic server-side validation
  if (!f1 || f1.length > 20) return res.status(400).send("Invalid first name");
  if (!f2 || f2.length > 20) return res.status(400).send("Invalid second name");
  if (!email) return res.status(400).send("Invalid email");
  if (!/^\d{10}$/.test(phone)) return res.status(400).send("Phone must be 10 digits");
  if (!/^[0-9][A-Za-z0-9]{5}$/.test(eir)) return res.status(400).send("Invalid eircode");

  //insert sanitized & validated data into the MySQL table (mysql_table)
  const sql =
    "INSERT INTO mysql_table (first_name, second_name, email, phone, eircode) VALUES (?,?,?,?,?)";

  db.query(sql, [f1, f2, email, phone, eir], (err, result) => {
    if (err) {
      console.error("DB INSERT ERROR:", err);
      return res.status(500).send("Database error");
    }
    //success response
    res.send("Saved with XSS protection!");
  });
});

//route: GET /upload-csv - read CSV, validate each row, insert valid rows 
app.get("/upload-csv", (req, res) => {
  const csvPath = "/mnt/data/person_info.csv"; 
  const validRows = [];       
  const errors = [];          
  let lineNumber = 1;         

  //check file exists before streaming
  if (!fs.existsSync(csvPath)) {
    return res.status(404).send(`CSV file not found at ${csvPath}`);
  }

  //stream the CSV and parse each row
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on("data", (row) => {
      const r = {
        first_name: (row.first_name || "").trim(),
        second_name: (row.second_name || "").trim(),
        email: (row.email || "").trim(),
        phone: (row.phone || "").trim(),
        eircode: (row.eircode || "").trim()
      };

      //validate row fields (basic checks)
      let rowError = null;
      if (!/^[A-Za-z0-9]{1,20}$/.test(r.first_name)) {
        rowError = `Row ${lineNumber} invalid: first_name`;
      } else if (!/^[A-Za-z0-9]{1,20}$/.test(r.second_name)) {
        rowError = `Row ${lineNumber} invalid: second_name`;
      } else if (!/^\S+@\S+\.\S+$/.test(r.email)) {
        rowError = `Row ${lineNumber} invalid: email`;
      } else if (!/^\d{10}$/.test(r.phone)) {
        rowError = `Row ${lineNumber} invalid: phone`;
      } else if (!/^[0-9][A-Za-z0-9]{5}$/.test(r.eircode)) {
        rowError = `Row ${lineNumber} invalid: eircode`;
      }

      if (rowError) {
        //keep the error with the row number (so the user can fix CSV)
        errors.push(rowError);
      } else {
        validRows.push({
          first_name: clean(r.first_name),
          second_name: clean(r.second_name),
          email: clean(r.email),
          phone: clean(r.phone),
          eircode: clean(r.eircode)
        });
      }

      lineNumber++;
    })
    .on("end", () => {
      //if there are errors, we will report them and still insert valid rows
      if (validRows.length === 0 && errors.length > 0) {
        //no valid row to insert
        return res.status(400).json({ message: "No valid rows", errors });
      }

      //insert rows in a simple loop; for large datasets use bulk insert or transactions
      const insertSql =
        "INSERT INTO mysql_table (first_name, second_name, email, phone, eircode) VALUES (?,?,?,?,?)";

      //track insertion results
      let inserted = 0;
      let insertErrors = [];

      //if no valid rows, skip insertion loop
      if (validRows.length === 0) {
        return res.json({ message: "CSV processed", inserted: 0, errors });
      }

      validRows.forEach((r, i) => {
        db.query(insertSql, [r.first_name, r.second_name, r.email, r.phone, r.eircode], (err) => {
          if (err) {
            //collect DB errors but continue attempting to insert the rest
            insertErrors.push({ row: i + 1, error: err.message });
          } else {
            inserted++;
          }

          //after last insertion attempt, return response
          if (i === validRows.length - 1) {
            res.json({
              message: "CSV processed",
              inserted,
              csvErrors: errors,
              insertErrors
            });
          }
        });
      });
    })
    .on("error", (err) => {
      console.error("CSV READ ERROR:", err);
      res.status(500).send("Error reading CSV file");
    });
});


//server: start listening
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
