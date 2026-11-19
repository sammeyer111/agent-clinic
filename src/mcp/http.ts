/**
 * AgentClinic Streamable HTTP & SSE MCP Transport
 *
 * Implements the Web Standard Streamable HTTP / SSE transport specification from
 * @modelcontextprotocol/sdk, allowing cloud-based autonomous agent swarms,
 * LangGraph, CrewAI, AutoGen, and remote IDEs to connect to AgentClinic over HTTP.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createAgentClinicMcpServer, McpServerConfig } from "./index.js";
import type { Hono } from "hono";

export interface McpHttpSetup {
  transport: WebStandardStreamableHTTPServerTransport;
  server: ReturnType<typeof createAgentClinicMcpServer>;
}

/**
 * Registers MCP Streamable HTTP & SSE transport endpoints on a Hono application instance:
 * - /mcp: Streamable HTTP endpoint (MCP spec)
 * - /mcp/sse: Server-Sent Events stream endpoint
 * - /mcp/messages: Incoming client JSON-RPC message target
 */
export function registerMcpHttpRoutes(
  app: Hono,
  config: McpServerConfig = {}
): McpHttpSetup {
  const server = createAgentClinicMcpServer(config);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode for zero cold-start & multi-replica edge
    enableJsonResponse: true,
  });

  // Connect the McpServer to the transport
  server.connect(transport).catch((err) => {
    console.error("[AgentClinic MCP HTTP] Connection error:", err);
  });

  const mcpHandler = async (c: any) => {
    // If request headers do not specify an Accept header, default to application/json, text/event-stream
    const acceptHeader = c.req.header("accept");
    if (!acceptHeader || acceptHeader === "*/*") {
      const headers = new Headers(c.req.raw.headers);
      headers.set("accept", "application/json, text/event-stream");
      const modifiedReq = new Request(c.req.raw, { headers });
      return transport.handleRequest(modifiedReq);
    }
    return transport.handleRequest(c.req.raw);
  };

  app.all("/mcp", mcpHandler);
  app.all("/mcp/sse", mcpHandler);
  app.all("/mcp/messages", mcpHandler);

  return {
    transport,
    server,
  };
}
