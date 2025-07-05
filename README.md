## Clone this repo anywhere on your PC

```shell
git clone https://github.com/openmost/matomo-mcp-client
```

```shell
npm install
```

## Register new MCP server for Claude Desktop

Add the following code to `claude_desktop_config.json`.

> For you first MCP server, you might have to create the file.
> 
> This file should be located here :
>
> - Windows : `C:\Users\YourName\AppData\Roaming\ClaudeDesktop\claude_desktop_config.json`
> - Linux : `~/.config/claude_desktop/claude_desktop_config.json`
> - macOS : `~/Library/Application Support/ClaudeDesktop/claude_desktop_config.json`


Copy and adapt this JSON file:

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
        "OPENMOST_MCP_TOKEN": "your_openmost_mcp_token",
        "MATOMO_HOST": "https://matomo.example.com",
        "MATOMO_TOKEN_AUTH": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude completely.

Enjoy.
