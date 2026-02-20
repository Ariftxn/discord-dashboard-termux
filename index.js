require("dotenv").config();
const express = require("express");
const session = require("express-session");
const fetch = require("node-fetch");
const rateLimit = require("express-rate-limit");
const sqlite3 = require("sqlite3").verbose();
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

const limiter = rateLimit({
  windowMs: 10000,
  max: 5
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.login(process.env.TOKEN);

const db = new sqlite3.Database("./database.db");
db.run(`CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channelId TEXT,
  content TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// ===== OAUTH =====

app.get("/login", (req, res) => {
  const url =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${process.env.CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=identify%20guilds`;
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/");

  const params = new URLSearchParams();
  params.append("client_id", process.env.CLIENT_ID);
  params.append("client_secret", process.env.CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", process.env.REDIRECT_URI);

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  const tokenData = await tokenRes.json();

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });

  const user = await userRes.json();
  req.session.user = user;

  res.redirect("/dashboard.html");
});

function checkAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/");
  next();
}

// ===== API =====

app.get("/api/guilds", checkAuth, async (req, res) => {
  const guilds = client.guilds.cache.map(g => ({
    id: g.id,
    name: g.name
  }));
  res.json(guilds);
});

app.get("/api/channels/:guildId", checkAuth, async (req, res) => {
  const guild = await client.guilds.fetch(req.params.guildId);
  const channels = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildText)
    .map(c => ({ id: c.id, name: c.name }));
  res.json(channels);
});

app.post("/api/send", checkAuth, limiter, async (req, res) => {
  try {
    const { channelId, message, embed, deleteAfter } = req.body;
    const channel = await client.channels.fetch(channelId);

    const randomColor = Math.floor(Math.random() * 16777215);

    const sent = await channel.send({
      content: message || null,
      embeds: embed?.title || embed?.description ? [{
        title: embed.title || null,
        description: embed.description || null,
        footer: embed.footer ? { text: embed.footer } : null,
        author: embed.author ? { name: embed.author } : null,
        thumbnail: embed.thumbnail ? { url: embed.thumbnail } : null,
        image: embed.image ? { url: embed.image } : null,
        timestamp: embed.timestamp ? new Date() : null,
        color: embed.color
          ? parseInt(embed.color.replace("#",""),16)
          : randomColor
      }] : []
    });

    db.run("INSERT INTO logs (channelId,content) VALUES (?,?)",
      [channelId, message || "embed"]);

    if (deleteAfter) {
      setTimeout(() => {
        sent.delete().catch(()=>{});
      }, deleteAfter * 1000);
    }

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed" });
  }
});

app.get("/api/logs", checkAuth, (req, res) => {
  db.all("SELECT * FROM logs ORDER BY createdAt DESC LIMIT 20", [],
    (err, rows) => res.json(rows));
});

app.listen(process.env.PORT, () =>
  console.log("Ultimate Localhost running on port " + process.env.PORT)
);