#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const args = process.argv.slice(2);
const serverUrl = args.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'https://matomo-mcp.openmost.io';

// MODIFICATION : Récupérer les variables depuis les arguments OU l'environnement
const clientEnv = {
    MATOMO_HOST: args.find(arg => arg.startsWith('--matomo-host='))?.split('=')[1] || process.env.MATOMO_HOST,
    MATOMO_TOKEN_AUTH: args.find(arg => arg.startsWith('--matomo-token='))?.split('=')[1] || process.env.MATOMO_TOKEN_AUTH,
    OPENMOST_MCP_TOKEN: args.find(arg => arg.startsWith('--openmost-token='))?.split('=')[1] || process.env.OPENMOST_MCP_TOKEN
};

console.error('🔷 Client env variables:', {
    MATOMO_HOST: clientEnv.MATOMO_HOST,
    MATOMO_TOKEN_AUTH: clientEnv.MATOMO_TOKEN_AUTH ? '***' : 'NOT SET',
    OPENMOST_MCP_TOKEN: clientEnv.OPENMOST_MCP_TOKEN ? '***' : 'NOT SET'
});

const server = new Server(
    { name: 'matomo-mcp-client', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

async function callRemoteServer(method, params = {}) {
    const requestBody = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
        env: clientEnv  // Envoyer les variables d'environnement
    };

    console.error('📤 Sending request to server:', JSON.stringify(requestBody, null, 2));

    try {
        const response = await fetch(`${serverUrl}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientEnv.OPENMOST_MCP_TOKEN}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.error('📥 Received response:', JSON.stringify(result, null, 2));

        return result;
    } catch (error) {
        console.error('❌ Error calling remote server:', error.message);
        throw error;
    }
}

// Handler pour lister les outils
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    console.error('📋 Listing tools...');

    try {
        const response = await callRemoteServer('tools/list');

        if (response.error) {
            throw new Error(response.error.message || 'Unknown error from server');
        }

        return { tools: response.tools || [] };
    } catch (error) {
        console.error('❌ Error listing tools:', error.message);
        throw error;
    }
});

// Handler pour appeler un outil
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error(`🔧 Calling tool: ${name} with args:`, args);

    try {
        const response = await callRemoteServer('tools/call', {
            name,
            arguments: args,
            id: Date.now()
        });

        if (response.error) {
            throw new Error(response.error.message || 'Unknown error from server');
        }

        return response.result;
    } catch (error) {
        console.error('❌ Error calling tool:', error.message);
        throw error;
    }
});

async function main() {
    // Vérifier que les variables sont présentes
    if (!clientEnv.MATOMO_HOST) {
        console.error('❌ MATOMO_HOST is required. Use --matomo-host=YOUR_HOST or set environment variable');
        process.exit(1);
    }

    if (!clientEnv.MATOMO_TOKEN_AUTH) {
        console.error('❌ MATOMO_TOKEN_AUTH is required. Use --matomo-token=YOUR_TOKEN or set environment variable');
        process.exit(1);
    }

    if (!clientEnv.OPENMOST_MCP_TOKEN) {
        console.error('❌ OPENMOST_MCP_TOKEN is required. Use --openmost-token=YOUR_TOKEN or set environment variable');
        process.exit(1);
    }

    console.error(`🚀 Starting Matomo MCP client, connecting to: ${serverUrl}`);
    console.error('🔷 Configuration validated successfully');

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ Matomo MCP client ready');
}

process.on('SIGINT', () => {
    console.error('🛑 SIGINT, shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.error('🛑 SIGTERM, shutting down...');
    process.exit(0);
});

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
