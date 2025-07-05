#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from 'node-fetch';

const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const serverUrl = urlArg ? urlArg.split('=')[1] : 'https://matomo-mcp.openmost.io';

const token = process.env.OPENMOST_MCP_TOKEN;
const matomoHost = process.env.MATOMO_HOST;
const matomoTokenAuth = process.env.MATOMO_TOKEN_AUTH;

if (!token) {
    console.error('OPENMOST_MCP_TOKEN environment variable is required');
    process.exit(1);
}

if (!matomoHost) {
    console.error('MATOMO_HOST environment variable is required');
    process.exit(1);
}

if (!matomoTokenAuth) {
    console.error('MATOMO_TOKEN_AUTH environment variable is required');
    process.exit(1);
}

class HttpMcpClient {
    constructor(serverUrl, token) {
        this.serverUrl = serverUrl;
        this.token = token;
        this.server = new Server(
            {
                name: "http-mcp-client",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                    resources: {},
                },
            }
        );
        this.setupHandlers();
    }

    async makeRequest(method, params = {}) {
        try {
            console.error(`Making request to: ${this.serverUrl}/mcp`);
            console.error(`Method: ${method}`);
            console.error(`Params:`, JSON.stringify(params, null, 2));

            const requestBody = {
                method: method,
                params: params
            };

            const response = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify(requestBody),
            });

            console.error(`Response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error response:`, errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.error(`Response:`, JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error(`Error making request with method ${method}:`, error);
            throw error;
        }
    }

    setupHandlers() {
        // Handler pour lister les outils
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            try {
                const result = await this.makeRequest('tools/list', {});
                return result;
            } catch (error) {
                console.error('Error listing tools:', error);
                return { tools: [] };
            }
        });

        // Handler pour exécuter les outils
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const result = await this.makeRequest('tools/call', {
                    name: request.params.name,
                    arguments: request.params.arguments
                });

                // Le serveur retourne déjà le format attendu avec result.content
                return result.result || result;
            } catch (error) {
                console.error('Error calling tool:', error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${error.message}`
                        }
                    ]
                };
            }
        });

        // Handler pour lister les ressources (optionnel, car votre serveur ne semble pas les supporter)
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            return { resources: [] };
        });

        // Handler pour lire les ressources (optionnel, car votre serveur ne semble pas les supporter)
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            return {
                contents: [
                    {
                        uri: request.params.uri,
                        mimeType: "text/plain",
                        text: `Resources not supported by this MCP server`
                    }
                ]
            };
        });
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('HTTP MCP Client connected to:', this.serverUrl);
    }
}

// Lancer le client
const client = new HttpMcpClient(serverUrl, token);
client.start().catch(console.error);
