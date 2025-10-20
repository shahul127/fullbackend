const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",       // your postgres username
  host: "localhost",
  database: "project", // your database name
  password: "Benshaja@1427", // your postgres password
  port: 5432,
});

module.exports = pool;
