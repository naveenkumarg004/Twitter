const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const startServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running Successfully at localhost:3000");
    });
  } catch (err) {
    console.log(`DB Error: ${err.message}`);
    process.exit(1);
  }
};

startServer();

// /register/ API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUser = `
        select * from user where username = "${username}"
        `;
  const getUserRes = await db.get(getUser);
  if (getUserRes) {
    const isValidLen = password.length;
    if (isValidLen >= 6) {
      const hashedPass = await bcrypt.hash(password, 10);
      const addUser = `
                insert into 
                user (name, username,password, gender)
                values ("${name}","${username}", "${hashedPass}", "${gender}")
                `;
      const newUser = await db.run(addUser);
      response.status(200);
      response.status("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
