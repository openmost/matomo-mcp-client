#!/usr/bin/env python3
"""
openmost-mcp-client.py - Standalone HTTP MCP client
No dependencies beyond Python standard library
"""

import sys
import json
import urllib.request
import urllib.error

def main():
    if len(sys.argv) < 5:
        print("Usage: python openmost-mcp-client.py <server-url> <auth-token> <matomo-host> <matomo-token>", file=sys.stderr)
        sys.exit(1)

    server_url = sys.argv[1]
    auth_token = sys.argv[2]
    matomo_host = sys.argv[3]
    matomo_token = sys.argv[4]

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}',
        'X-Matomo-Host': matomo_host,
        'X-Matomo-Token-Auth': matomo_token
    }

    request_id = 0

    # Debug: Log startup
    print(f"Starting MCP client, connecting to: {server_url}", file=sys.stderr)

    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                # Parse JSON request
                request_data = json.loads(line)

                # Debug: Log request
                print(f"Received request: {request_data.get('method', 'unknown')}", file=sys.stderr)

                # Add ID if missing
                if 'id' not in request_data:
                    request_id += 1
                    request_data['id'] = request_id

                # Handle MCP methods locally
                method = request_data.get('method')

                if method == 'initialize':
                    # Return initialize response
                    response = {
                        "jsonrpc": "2.0",
                        "id": request_data['id'],
                        "result": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {
                                "tools": {}
                            },
                            "serverInfo": {
                                "name": "openmost-matomo-mcp",
                                "version": "1.0.0"
                            }
                        }
                    }
                    print(json.dumps(response))
                    sys.stdout.flush()
                    continue

                elif method == 'notifications/initialized':
                    # Just acknowledge, no response needed for notifications
                    continue

                elif method == 'notifications/cancelled':
                    # Just acknowledge, no response needed for notifications
                    continue

                elif method == 'resources/list':
                    # Return empty resources list
                    response = {
                        "jsonrpc": "2.0",
                        "id": request_data['id'],
                        "result": {
                            "resources": []
                        }
                    }
                    print(json.dumps(response))
                    sys.stdout.flush()
                    continue

                elif method == 'prompts/list':
                    # Return empty prompts list
                    response = {
                        "jsonrpc": "2.0",
                        "id": request_data['id'],
                        "result": {
                            "prompts": []
                        }
                    }
                    print(json.dumps(response))
                    sys.stdout.flush()
                    continue

                # For tools/list and tools/call, forward to HTTP server
                elif method in ['tools/list', 'tools/call']:
                    print(f"Forwarding {method} to HTTP server...", file=sys.stderr)
                    req_data = json.dumps(request_data).encode('utf-8')
                    req = urllib.request.Request(server_url, data=req_data, headers=headers)

                    print(f"Sending request to {server_url}", file=sys.stderr)
                    print(f"Headers: {headers}", file=sys.stderr)
                    print(f"Data: {request_data}", file=sys.stderr)

                    # Send request
                    with urllib.request.urlopen(req, timeout=30) as response:
                        response_text = response.read().decode('utf-8')
                        print(f"HTTP Response: {response_text}", file=sys.stderr)

                        # Parse the HTTP response
                        http_response_data = json.loads(response_text)

                        # Convert HTTP response to proper JSON-RPC response
                        if 'tools' in http_response_data:
                            # This is a tools/list response
                            jsonrpc_response = {
                                "jsonrpc": "2.0",
                                "id": request_data['id'],
                                "result": {
                                    "tools": http_response_data['tools']
                                }
                            }
                        elif 'content' in http_response_data:
                            # This is a tools/call response
                            jsonrpc_response = {
                                "jsonrpc": "2.0",
                                "id": request_data['id'],
                                "result": http_response_data
                            }
                        elif 'error' in http_response_data:
                            # This is an error response
                            jsonrpc_response = {
                                "jsonrpc": "2.0",
                                "id": request_data['id'],
                                "error": http_response_data['error']
                            }
                        else:
                            # Fallback - wrap the entire response
                            jsonrpc_response = {
                                "jsonrpc": "2.0",
                                "id": request_data['id'],
                                "result": http_response_data
                            }

                        print(json.dumps(jsonrpc_response))
                        sys.stdout.flush()

                else:
                    # Unknown method
                    error_response = {
                        "jsonrpc": "2.0",
                        "id": request_data.get('id'),
                        "error": {
                            "code": -32601,
                            "message": f"Method not found: {method}"
                        }
                    }
                    print(json.dumps(error_response))
                    sys.stdout.flush()

            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}", file=sys.stderr)
                error_response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32700, "message": "Parse error"}
                }
                print(json.dumps(error_response))
            except urllib.error.HTTPError as e:
                print(f"HTTP error: {e}", file=sys.stderr)
                try:
                    error_body = e.read().decode('utf-8')
                    error_data = json.loads(error_body)
                    # Forward the error from the HTTP server
                    error_response = {
                        "jsonrpc": "2.0",
                        "id": request_data.get('id'),
                        "error": error_data.get('error', {"code": -32603, "message": f"HTTP error: {e}"})
                    }
                except:
                    error_response = {
                        "jsonrpc": "2.0",
                        "id": request_data.get('id'),
                        "error": {"code": -32603, "message": f"HTTP error: {e}"}
                    }
                print(json.dumps(error_response))
            except urllib.error.URLError as e:
                print(f"Network error: {e}", file=sys.stderr)
                error_response = {
                    "jsonrpc": "2.0",
                    "id": request_data.get('id'),
                    "error": {"code": -32603, "message": f"Network error: {e}"}
                }
                print(json.dumps(error_response))
            except Exception as e:
                print(f"Unexpected error: {e}", file=sys.stderr)
                error_response = {
                    "jsonrpc": "2.0",
                    "id": request_data.get('id'),
                    "error": {"code": -32603, "message": f"Internal error: {e}"}
                }
                print(json.dumps(error_response))

    except KeyboardInterrupt:
        print("MCP client shutting down", file=sys.stderr)
        sys.exit(0)

if __name__ == "__main__":
    main()
