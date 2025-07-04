## Register new MCP server

Add this to `claude_desktop_config.json`.

- Windows : `C:\Users\YourName\AppData\Roaming\ClaudeDesktop\claude_desktop_config.json`
- Linux : `~/.config/claude_desktop/claude_desktop_config.json`
- macOS : `~/Library/Application Support/ClaudeDesktop/claude_desktop_config.json`

Copy and adapt this JSON file:

```json
{
    "mcpServers": {
        "openmost-matomo-mcp": {
            "command": "python",
            "args": [
                "openmost-mcp-client.py",
                "https://matomo-mcp.openmost.io",
                "YOUR_OPENMOST_MCP_TOKEN",
                "https://matomo.example.com",
                "matomo_token_auth_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            ],
            "cwd": "./path/to/your/client/files"
        }
    }
}
```
