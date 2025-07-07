#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

// Configuration depuis les arguments ou variables d'environnement
const args = process.argv.slice(2);
const config = {
    serverUrl: args.find(arg => arg.startsWith('--url='))?.split('=')[1] ||
        process.env.MATOMO_MCP_SERVER_URL ||
        'https://matomo-mcp.openmost.io',

    timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) ||
        parseInt(process.env.REQUEST_TIMEOUT) ||
        30000, // 30 secondes

    retryCount: parseInt(args.find(arg => arg.startsWith('--retry='))?.split('=')[1]) ||
        parseInt(process.env.RETRY_COUNT) ||
        3,

    retryDelay: parseInt(args.find(arg => arg.startsWith('--retry-delay='))?.split('=')[1]) ||
        parseInt(process.env.RETRY_DELAY) ||
        1000 // 1 seconde
};

// Variables d'environnement Matomo
const clientEnv = {
    MATOMO_HOST: args.find(arg => arg.startsWith('--matomo-host='))?.split('=')[1] ||
        process.env.MATOMO_HOST,
    MATOMO_TOKEN_AUTH: args.find(arg => arg.startsWith('--matomo-token='))?.split('=')[1] ||
        process.env.MATOMO_TOKEN_AUTH,
    OPENMOST_MCP_TOKEN: args.find(arg => arg.startsWith('--openmost-token='))?.split('=')[1] ||
        process.env.OPENMOST_MCP_TOKEN
};

// Validation de la configuration
function validateConfig() {
    const errors = [];

    if (!clientEnv.MATOMO_HOST) {
        errors.push('MATOMO_HOST is required. Use --matomo-host=YOUR_HOST or set environment variable');
    }

    if (!clientEnv.MATOMO_TOKEN_AUTH) {
        errors.push('MATOMO_TOKEN_AUTH is required. Use --matomo-token=YOUR_TOKEN or set environment variable');
    }

    if (!clientEnv.OPENMOST_MCP_TOKEN) {
        errors.push('OPENMOST_MCP_TOKEN is required. Use --openmost-token=YOUR_TOKEN or set environment variable');
    }

    // Validation de l'URL du serveur
    try {
        new URL(config.serverUrl);
    } catch (error) {
        errors.push(`Invalid server URL: ${config.serverUrl}`);
    }

    // Validation de MATOMO_HOST
    if (clientEnv.MATOMO_HOST) {
        try {
            new URL(clientEnv.MATOMO_HOST);
        } catch (error) {
            errors.push(`Invalid MATOMO_HOST URL: ${clientEnv.MATOMO_HOST}`);
        }
    }

    return errors;
}

console.error('🔷 Client configuration:', {
    serverUrl: config.serverUrl,
    timeout: config.timeout,
    retryCount: config.retryCount,
    MATOMO_HOST: clientEnv.MATOMO_HOST,
    MATOMO_TOKEN_AUTH: clientEnv.MATOMO_TOKEN_AUTH ? '***' : 'NOT SET',
    OPENMOST_MCP_TOKEN: clientEnv.OPENMOST_MCP_TOKEN ? '***' : 'NOT SET'
});

const server = new Server(
    { name: 'matomo-mcp-client', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

// Cache pour éviter les appels répétés à tools/list
let toolsCache = null;
let toolsCacheTime = 0;
const TOOLS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Appel au serveur distant avec retry et timeout
 */
async function callRemoteServer(method, params = {}, requestId = null) {
    const actualRequestId = requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const requestBody = {
        jsonrpc: '2.0',
        id: actualRequestId,
        method,
        params,
        env: clientEnv
    };

    console.error(`📤 [${actualRequestId}] Sending request to server: ${method}`);
    console.error(`📤 [${actualRequestId}] Params:`, JSON.stringify(params, null, 2));

    let lastError;

    for (let attempt = 1; attempt <= config.retryCount; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeout);

            const response = await fetch(`${config.serverUrl}/mcp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${clientEnv.OPENMOST_MCP_TOKEN}`,
                    'User-Agent': 'Matomo-MCP-Client/1.0',
                    'X-Request-ID': actualRequestId,
                    'X-Client-Version': '1.0.0'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.error?.message) {
                        errorMessage = errorJson.error.message;
                    }
                } catch {
                    // Garder le message HTTP si le parsing JSON échoue
                    if (errorText) {
                        errorMessage += ` - ${errorText.substring(0, 200)}`;
                    }
                }

                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.error(`📥 [${actualRequestId}] Received response successfully`);

            // Validation de la réponse JSON-RPC
            if (result.error) {
                throw new Error(`Server error: ${result.error.message || 'Unknown error'}`);
            }

            return result;

        } catch (error) {
            lastError = error;

            if (error.name === 'AbortError') {
                console.error(`⏰ [${actualRequestId}] Request timeout after ${config.timeout}ms (attempt ${attempt}/${config.retryCount})`);
            } else {
                console.error(`❌ [${actualRequestId}] Attempt ${attempt}/${config.retryCount} failed: ${error.message}`);
            }

            // Ne pas retry sur certaines erreurs
            if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Invalid token')) {
                console.error(`🚫 [${actualRequestId}] Authentication error, not retrying`);
                break;
            }

            if (attempt < config.retryCount) {
                const delay = config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.error(`⏳ [${actualRequestId}] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error(`Request failed after ${config.retryCount} attempts: ${lastError.message}`);
}

/**
 * Test de connectivité au serveur
 */
async function testServerConnection() {
    try {
        console.error('🔍 Testing server connectivity...');

        const response = await fetch(config.serverUrl.replace('/mcp', ''), {
            method: 'GET',
            headers: {
                'User-Agent': 'Matomo-MCP-Client/1.0'
            },
            timeout: 10000
        });

        if (response.ok) {
            const result = await response.json();
            console.error('✅ Server is accessible:', result);
            return true;
        } else {
            console.error(`⚠️ Server responded with status ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Server connectivity test failed:', error.message);
        return false;
    }
}

// Handler pour lister les outils avec cache
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    const requestId = `list-${Date.now()}`;
    console.error(`📋 [${requestId}] Listing tools...`);

    try {
        // Vérifier le cache
        const now = Date.now();
        if (toolsCache && (now - toolsCacheTime) < TOOLS_CACHE_TTL) {
            console.error(`📋 [${requestId}] Using cached tools list`);
            return { tools: toolsCache };
        }

        const response = await callRemoteServer('tools/list', {}, requestId);

        if (response.error) {
            throw new Error(response.error.message || 'Unknown error from server');
        }

        // Mise à jour du cache
        toolsCache = response.tools || response.result?.tools || [];
        toolsCacheTime = now;

        console.error(`📋 [${requestId}] Found ${toolsCache.length} tools`);
        return { tools: toolsCache };

    } catch (error) {
        console.error(`❌ [${requestId}] Error listing tools: ${error.message}`);
        throw error;
    }
});

// Handler pour appeler un outil
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const requestId = `call-${name}-${Date.now()}`;

    console.error(`🔧 [${requestId}] Calling tool: ${name}`);
    console.error(`🔧 [${requestId}] Arguments:`, JSON.stringify(args, null, 2));

    try {
        const response = await callRemoteServer('tools/call', {
            name,
            arguments: args,
            id: requestId
        }, requestId);

        if (response.error) {
            throw new Error(response.error.message || 'Unknown error from server');
        }

        console.error(`🔧 [${requestId}] Tool call successful`);
        return response.result;

    } catch (error) {
        console.error(`❌ [${requestId}] Error calling tool: ${error.message}`);
        throw error;
    }
});

/**
 * Affichage de l'aide
 */
function showHelp() {
    console.error(`
Matomo MCP Client - Proxy to remote Matomo MCP server

Usage: node client.js [options]

Options:
  --url=URL                 Remote server URL (default: https://matomo-mcp.openmost.io)
  --matomo-host=URL         Matomo installation URL
  --matomo-token=TOKEN      Matomo API token
  --openmost-token=TOKEN    Openmost MCP authentication token
  --timeout=MS              Request timeout in milliseconds (default: 30000)
  --retry=COUNT             Number of retry attempts (default: 3)
  --retry-delay=MS          Initial retry delay in milliseconds (default: 1000)
  --help                    Show this help

Environment variables:
  MATOMO_MCP_SERVER_URL     Remote server URL
  MATOMO_HOST               Matomo installation URL
  MATOMO_TOKEN_AUTH         Matomo API token
  OPENMOST_MCP_TOKEN        Openmost MCP authentication token
  REQUEST_TIMEOUT           Request timeout in milliseconds
  RETRY_COUNT               Number of retry attempts
  RETRY_DELAY               Initial retry delay in milliseconds

Examples:
  node client.js --matomo-host=https://analytics.example.com --matomo-token=abc123 --openmost-token=xyz789
  MATOMO_HOST=https://analytics.example.com node client.js
`);
}

async function main() {
    // Afficher l'aide si demandée
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    // Validation de la configuration
    const configErrors = validateConfig();
    if (configErrors.length > 0) {
        console.error('❌ Configuration errors:');
        configErrors.forEach(error => console.error(`   - ${error}`));
        console.error('\nUse --help for usage information');
        process.exit(1);
    }

    console.error(`🚀 Starting Matomo MCP client`);
    console.error(`🌐 Connecting to: ${config.serverUrl}`);
    console.error('🔷 Configuration validated successfully');

    // Test de connectivité optionnel
    if (process.env.NODE_ENV !== 'production') {
        await testServerConnection();
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ Matomo MCP client ready');
}

// Gestion des signaux système
process.on('SIGINT', () => {
    console.error('🛑 SIGINT received, shutting down client...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.error('🛑 SIGTERM received, shutting down client...');
    process.exit(0);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception in client:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection in client:', reason);
    process.exit(1);
});

// Démarrage
main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
});
