import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import fetch from "node-fetch";
import multer from "multer";
import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from "discord.js";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.login(process.env.TOKEN);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// LOGIN
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
  res.redirect(url);
});

// CALLBACK
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  const data = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.REDIRECT_URI
  });

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    body: data,
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

// GET GUILDS
app.get("/guilds", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });

  const userRes = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${req.session.accessToken}` }
  });

  const guilds = await userRes.json();
  res.json(guilds);
});

// SEND MESSAGE
app.post("/send", upload.single("file"), async (req, res) => {
  const { channelId, content, title, description, footer, color } = req.body;

  const channel = await client.channels.fetch(channelId);
  if (!channel) return res.status(400).json({ error: "Channel not found" });

  const embed = new EmbedBuilder()
    .setTitle(title || null)
    .setDescription(description || null)
    .setFooter(footer ? { text: footer } : null)
    .setColor(color || Math.floor(Math.random() * 16777215));

  const files = [];

  if (req.file) {
    files.push(new AttachmentBuilder(req.file.path));
  }

  await channel.send({
    content: content || null,
    embeds: