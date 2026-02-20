require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const { v4: uuidv4 } = require("uuid");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.login(process.env.TOKEN);

const db = new sqlite3.Database("./database.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT,
    data TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    channelId TEXT,
    content TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

const limiter = rateLimit({ windowMs: 10000, max: 5 });

function checkAuth(req, res, next) {
  const password = req.headers["x-admin-password"];
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/api/guilds", async (req, res) => {
  const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name }));
  res.json(guilds);
});

app.get("/api/channels/:guildId", async (req, res) => {
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
          ? parseInt(embed.color.replace("#", ""), 16)
          : randomColor
      }] : []
    });

    db.run(
      "INSERT INTO logs (id,channelId,content) VALUES (?,?,?)",
      [uuidv4(), channelId, message || "embed"]
    );

    if (deleteAfter) {
      setTimeout(() => {
        sent.delete().catch(() => {});
      }, deleteAfter * 1000);
    }

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error sending message" });
  }
});

app.listen(process.env.PORT, () =>
  console.log("Panel running on port " + process.env.PORT)
);
