import { Client, GatewayIntentBits } from "discord.js";
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`Bot login sebagai ${client.user.tag}`);
});

app.get("/api/guilds", (req, res) => {
  const guilds = client.guilds.cache.map(g => ({
    id: g.id,
    name: g.name
  }));
  res.json(guilds);
});

app.get("/api/channels/:guildId", async (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: "Guild tidak ditemukan" });

  const channels = guild.channels.cache
    .filter(c => c.isTextBased())
    .map(c => ({
      id: c.id,
      name: c.name
    }));

  res.json(channels);
});

app.post("/api/send", async (req, res) => {
  const { channelId, message, embed } = req.body;

  try {
    const channel = await client.channels.fetch(channelId);

    if (embed) {
      await channel.send({
        embeds: [{
          title: embed.title,
          description: embed.description,
          color: 0x5865F2
        }]
      });
    } else {
      await channel.send(message);
    }

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Gagal kirim pesan" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dashboard jalan di http://localhost:${PORT}`));

client.login(process.env.TOKEN);