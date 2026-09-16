import { readFileSync, existsSync } from "node:fs";

// Securely load token from environment, CLI argument, or gitignored .dev.vars
let token = process.env.TELEGRAM_BOT_TOKEN || process.argv[2];

if (!token && existsSync(".dev.vars")) {
  const devVars = readFileSync(".dev.vars", "utf8");
  const match = devVars.match(/TELEGRAM_BOT_TOKEN\s*=\s*["']?([^"'\r\n]+)["']?/);
  if (match) token = match[1].trim();
}

if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not provided. Set TELEGRAM_BOT_TOKEN env variable or pass it as an argument: node scripts/set-commands.js <TOKEN>");
  process.exit(1);
}

const commands = [
  { command: "gadgets", description: "Prices for Sony XM6, Watch 8 and Fitbit" },
  { command: "stock", description: "Browse in-stock botanicals catalog" },
  { command: "psychedelic", description: "In-stock entheogens and psychedelics" },
  { command: "search", description: "Search botanicals by keyword" },
  { command: "check", description: "Refresh stock and gadget prices now" },
  { command: "help", description: "Show commands and help guide" }
];

async function main() {
  console.log("Registering bot commands with Telegram...");
  const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands })
  });
  const data = await res.json();
  console.log("setMyCommands result:", data);

  console.log("Configuring Chat Menu Button to Commands list...");
  const menuRes = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ menu_button: { type: "commands" } })
  });
  const menuData = await menuRes.json();
  console.log("setChatMenuButton result:", menuData);
}

main().catch(console.error);
