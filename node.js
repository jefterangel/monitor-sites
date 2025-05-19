// backend/server.js
import 'dotenv/config';
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import twilio from "twilio";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Lista de sites monitorados (pode ser lida de um banco depois)
let sites = [
  { name: "Tambasa", url: "https://loja.tambasa.com", status: "Desconhecido", lastAlert: null },
  { name: "GB", url: "https://loja.gbatacadistas.com", status: "Desconhecido", lastAlert: null },
  { name: "Armarinho", url: "https://loja.armarinhobartolomeu.com", status: "Desconhecido", lastAlert: null },
  { name: "Oi Brasil", url: "https://loja.oiatacadistas.com", status: "Desconhecido", lastAlert: null },
  { name: "Evoluir", url: "https://loja.evoluiratacadistas.com", status: "Desconhecido", lastAlert: null },
  { name: "Televendas", url: "https://televendas.tambasa.com", status: "Desconhecido", lastAlert: null },
  { name: "Godeep Admin", url: "https://loja.tambasa.com/admin", status: "Desconhecido", lastAlert: null },
  { name: "Terceirizado", url: "https://httpstat.us/404/", status: "Desconhecido", lastAlert: null },
  { name: "Vivara Láele", url: "https://httpstat.us/503/", status: "Desconhecido", lastAlert: null },
];

// Configurações do Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Lista de números para receber alerta (adicione quantos quiser)
const alertNumbers = [
  'whatsapp:+553133590853', // Seu número
  'whatsapp:+553133590958', // Outro número
  // Adicione mais números aqui
];

// Função para enviar mensagem WhatsApp para todos os números
async function enviarWhatsapp(mensagem) {
  for (const numero of alertNumbers) {
    await client.messages.create({
      body: mensagem,
      from: 'whatsapp:+14155238886', // Número do sandbox Twilio
      to: numero
    });
  }
}

// Mapeamento dos códigos HTTP para significado
const httpStatusMessages = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  408: "Request Timeout",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  // Adicione outros conforme necessário
};

// Função para verificar status dos sites
async function verificarSites() {
  const now = Date.now();
  for (let site of sites) {
    try {
      const res = await fetch(site.url);
      site.httpCode = res.status;
      site.lastChecked = new Date().toLocaleString('pt-BR', { hour12: false });

      if (res.status >= 200 && res.status < 300) {
        site.status = "Online";
      } else {
        // Se não for 2xx, mostra Offline (Significado)
        const msg = httpStatusMessages[res.status] || "Erro";
        site.status = `Offline (${msg})`;
      }
    } catch (error) {
      site.status = "Offline (Erro de conexão)";
      site.httpCode = null;
      site.lastChecked = new Date().toLocaleString('pt-BR', { hour12: false });
    }

    // Envia alerta se está offline e já passou 5 minutos do último aviso
    if (site.status !== "Online") {
      if (!site.lastAlert || now - site.lastAlert > 5 * 60 * 1000) { // 5 minutos em ms
        await enviarWhatsapp(
          `⚠️ *ALERTA DE SITE OFFLINE!*\n` +
          `Nome: ${site.name}\n` +
          `URL: ${site.url}\n` +
          `Status: ${site.status}\n` +
          `Código HTTP: ${site.httpCode !== null ? site.httpCode : 'Erro'}\n` +
         `Data/Hora: ${site.lastChecked || '-'}`
);
        site.lastAlert = now;
      }
    } else {
      site.lastAlert = null; // Reseta quando volta ao ar
    }
  }
}

// Rota para retornar o status dos sites
app.get("/status", async (req, res) => {
  await verificarSites();
  res.json(sites);
});

// Rota para adicionar novos sites (futuramente com persistência)
app.post("/add", (req, res) => {
  const { name, url } = req.body;
  if (name && url && !sites.find(s => s.url === url)) {
    sites.push({ name, url, status: "Desconhecido" });
    return res.status(201).json({ message: "Site adicionado" });
  }
  res.status(400).json({ message: "Nome ou URL inválido ou já existe" });
});

// Rota inicial
app.get("/", (req, res) => {
  res.send("Monitor de Sites rodando! 🚦");
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
