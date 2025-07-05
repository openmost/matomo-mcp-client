
# Openmost Matomo MCP Client

## 📋 Description

This repository contains the **client for the Openmost Matomo MCP server**.  
It enables you to connect Claude AI Desktop (or any other LLM that supports [MCP — Model Context Protocol](https://github.com/modelcontext/protocol)) to a [Matomo](https://matomo.org/) analytics instance, via the Openmost MCP server.

You need to install and configure this client to act as a bridge between your Claude Desktop app and your Matomo analytics data.

---

## 🚀 Installation

### 1️⃣ Clone the repository

```bash
git clone https://github.com/openmost/matomo-mcp-client
cd matomo-mcp-client
```

### 2️⃣ Install dependencies

```bash
npm install
```

---

## 🔧 Configuration

### Register the MCP client in Claude Desktop

You need to tell Claude Desktop about this MCP client by editing its configuration file.

#### 📄 Location of the configuration file

You must add your MCP server config into the file:

`claude_desktop_config.json`

If it does not exist yet, you can create it.

Depending on your operating system, the file should be placed at:

| OS       | Path                                                                     |
|----------|--------------------------------------------------------------------------|
| **Windows** | `C:\Users\your-name\AppData\Roaming\Claude\claude_desktop_config.json`   |
| **Linux**   | `~/.config/claude_desktop/claude_desktop_config.json`                    |
| **macOS**   | `~/Library/Application Support/ClaudeDesktop/claude_desktop_config.json` |

---

### 📝 Example configuration

Below is an example of how to register the Openmost Matomo MCP client in `claude_desktop_config.json`.  
You can adapt the paths, tokens, and URLs to fit your environment.

```json
{
  "mcpServers": {
    "openmost-matomo-mcp": {
      "command": "node",
      "args": [
        "C:/wamp64/www/matomo-mcp-client/matomo-mcp-client.js",
        "--url=https://matomo-mcp.openmost.io"
      ],
      "env": {
        "OPENMOST_MCP_TOKEN": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "MATOMO_HOST": "https://matomo.example.com",
        "MATOMO_TOKEN_AUTH": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

✅ Replace:
- `OPENMOST_MCP_TOKEN` with the token you got from Openmost (ronan@openmost.io).
- `MATOMO_HOST` with the URL of your Matomo instance.
- `MATOMO_TOKEN_AUTH` with your Matomo API token.

---

### 🔄 Restart Claude Desktop

After saving the configuration file, completely quit and restart Claude Desktop for the changes to take effect.

---

## 🎉 Usage

Once everything is configured and Claude has restarted:
- Open Claude Desktop.
- In the model selector, choose the MCP server named:  
  **`openmost-matomo-mcp`**
- Start interacting!  
  Your requests will now be processed through the Matomo MCP client and served by your Matomo analytics data.

---

## 📖 Resources

- [Openmost](https://openmost.io)
- [Matomo Analytics](https://matomo.org)
- [Claude Desktop](https://claude.ai/download)
- [MCP Protocol](https://github.com/modelcontext/protocol)
