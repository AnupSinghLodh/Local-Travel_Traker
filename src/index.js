import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { getPgClient, connectIfNeeded } from "../config/db.js";
import serverless from 'serverless-http';
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// console.log(__dirname);
// If this repository is split into frontend/ and backend/, prefer the frontend views/public folders
const repoRoot = path.resolve(__dirname, "frontend/");
const frontendViews = path.join(repoRoot, "frontend", "views");
const frontendPublic = path.join(repoRoot, "frontend", "public");
console.log(repoRoot)
console.log(frontendViews)
console.log(frontendPublic)

app.set("view engine", "ejs");

if (fs.existsSync(frontendViews)) {
  app.set("views", frontendViews);
} else {
  app.set("views", path.join(__dirname, "../views"));
}

if (fs.existsSync(frontendPublic)) {
  app.use(express.static(frontendPublic));
} else {
  app.use(express.static(path.join(__dirname, "../public")));
}

// Require DATABASE_URL (connection string) — backend expects a connection string
// rather than individual DB_* variables. Exit early if not provided.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required for the backend and was not found in the environment. Exiting.');
  process.exit(1);
}

// Keep TLS certificate verification enabled by default. To explicitly disable
// verification (not recommended) set DB_REJECT_UNAUTHORIZED=false in the env.
const ssl = { rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED === 'false' ? false : true };

const db = getPgClient();
console.log(process.argv[1])
console.log(__filename)
if (process.argv[1] === __filename) {
  (async () => {
    try {
      await connectIfNeeded();
      console.log('Connected to PostgreSQL database');
      app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
      });
    } catch (err) {
      console.error('Database connection failed:', err);
      process.exit(1);
    }
  })();
}


app.use(bodyParser.urlencoded({ extended: true }));

let selectedUserId = 1;

async function fetchVisitedstateCodes(userId) {
  try {
    const result = await db.query(
      "SELECT state_code FROM visited_states JOIN users ON users.id = user_id WHERE user_id = $1;",
      [userId]
    );

    const states = [];
    result.rows.forEach((state) => {
      states.push(state.state_code);
    });
    return states;
  } catch (err) {
    console.error('Error fetching visited states:', err);
    return [];
  }
}

async function fetchUserColor(userId) {
  try {
    const result = await db.query("SELECT color FROM users WHERE users.id = $1;", [userId]);
    return result.rows[0]?.color || "teal";
  } catch (err) {
    console.error('Error fetching user color:', err);
    return "teal";
  }
}

async function fetchUsers() {
  try {
    const result = await db.query("SELECT * FROM users");
    return result.rows;
  } catch (err) {
    console.error('Error fetching users:', err);
    return [];
  }
}

app.get("/", async (req, res) => {
  try {
    const states = await fetchVisitedstateCodes(selectedUserId);
    const userColor = await fetchUserColor(selectedUserId);
    const users = await fetchUsers();
    res.render("index.ejs", {
      states: states,
      total: states.length,
      users: users,
      color: userColor,
    });
  } catch (err) {
    console.error('Error rendering home page:', err);
    res.status(500).send("Something went wrong");
  }
});

app.post("/api/visited", async (req, res) => {
  const input = req.body["state"];

    // Guard empty input
    if (!input || !input.toString().trim()) {
      return res.redirect("/");
    }

    try {
      const result = await db.query(
        "SELECT state_code FROM states WHERE LOWER(state_name) LIKE $1 || '%';",
        [input.toLowerCase()]
      );

      const data = result.rows[0];
      if (!data) {
        return res.redirect("/");
      }

      const stateCode = data.state_code;

      await db.query(
        "INSERT INTO visited_states (state_code, user_id) VALUES ($1, $2)",
        [stateCode, selectedUserId]
      );

      res.redirect("/");
    } catch (err) {
      console.error('Error adding state:', err);
      res.redirect("/");
    }
  });

app.post("/api-users", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    selectedUserId = req.body.user;
    res.redirect("/");
  }

});


app.post("/api/users", async (req, res) => {
  try {
    const name = req.body.name;
    const color = req.body.color;

    const result = await db.query(
      "INSERT INTO users(name, color) VALUES($1, $2) RETURNING *",
      [name, color]
    );

    selectedUserId = result.rows[0].id;
    res.redirect("/");
  } catch (err) {
    console.error('Error creating new user:', err);
    res.redirect("/");
  }
});

app.post("/api/visited/delete", async (req, res) => {
  const input = req.body["state"];

  if (!input || !input.toString().trim()) {
    return res.redirect("/");
  }

  try {
    const result = await db.query(
      "SELECT state_code FROM states WHERE LOWER(state_name) LIKE $1 || '%';",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    if (!data) {
      return res.redirect("/");
    }

    const stateCode = data.state_code;

    await db.query(
      "DELETE FROM visited_states AS vc WHERE vc.user_id = $1 AND vc.state_code = $2;",
      [selectedUserId, stateCode]
    );

    res.redirect("/");
  } catch (err) {
    console.error('Error Deleting state:', err);
    res.redirect("/");
  }
});

app.post("/api/users/delete", async (req, res) => {
  try{
    const userIdToDelete = selectedUserId;
    await db.query("BEGIN");

    await db.query(
      "DELETE FROM visited_states AS vc WHERE vc.user_id = $1;",
      [userIdToDelete]
    );

    await db.query(
      "DELETE FROM users AS u WHERE u.id = $1;",
      [userIdToDelete]
    );

    const nextUserResult = await db.query("SELECT id FROM users ORDER BY id LIMIT 1;");
    selectedUserId = nextUserResult.rows[0]?.id ?? null;

    await db.query("COMMIT");
    res.redirect("/");
  } catch (err) {
    await db.query("ROLLBACK");
    console.error('Error Deleting Member:', err);
    res.redirect("/");
  }
});

export default serverless(app);
