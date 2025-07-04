## Clone this repo anywhere on your PC

```shell
git clone https://github.com/openmost/matomo-mcp-client
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
            "command": "python",
            "args": [
                "openmost-mcp-client.py",
                "https://matomo-mcp.openmost.io/mcp",
                "YOUR_OPENMOST_MCP_TOKEN",
                "YOUR_MATOMO_HOST",
                "YOUR_MATOMO_TOKEN_AUTH"
            ],
            "cwd": "./path/to/your/client/files"
        }
    }
}
```

Restart Claude completely.

Enjoy.
