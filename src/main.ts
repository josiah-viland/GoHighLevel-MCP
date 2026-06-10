/**
 * GoHighLevel MCP Server - Streamable HTTP Transport
 * For Claude.ai web integration
 */

import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as dotenv from 'dotenv';

import { GHLApiClient } from './clients/ghl-api-client';
import { ContactTools } from './tools/contact-tools';
import { ConversationTools } from './tools/conversation-tools';
import { BlogTools } from './tools/blog-tools';
import { OpportunityTools } from './tools/opportunity-tools';
import { CalendarTools } from './tools/calendar-tools';
import { EmailTools } from './tools/email-tools';
import { LocationTools } from './tools/location-tools';
import { EmailISVTools } from './tools/email-isv-tools';
import { SocialMediaTools } from './tools/social-media-tools';
import { MediaTools } from './tools/media-tools';
import { ObjectTools } from './tools/object-tools';
import { AssociationTools } from './tools/association-tools';
import { CustomFieldV2Tools } from './tools/custom-field-v2-tools';
import { WorkflowTools } from './tools/workflow-tools';
import { SurveyTools } from './tools/survey-tools';
import { StoreTools } from './tools/store-tools';
import { ProductsTools } from './tools/products-tools.js';
import { GHLConfig } from './types/ghl-types';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '8000');

app.use(cors({
  origin: ['https://chatgpt.com', 'https://chat.openai.com', 'https://claude.ai', 'http://localhost:*'],
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Mcp-Session-Id'],
  credentials: true
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Initialize GHL client
const config: GHLConfig = {
  accessToken: process.env.GHL_API_KEY || '',
  baseUrl: process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
  version: '2021-07-28',
  locationId: process.env.GHL_LOCATION_ID || ''
};

if (!config.accessToken) throw new Error('GHL_API_KEY is required');
if (!config.locationId) throw new Error('GHL_LOCATION_ID is required');

const ghlClient = new GHLApiClient(config);
const contactTools = new ContactTools(ghlClient);
const conversationTools = new ConversationTools(ghlClient);
const blogTools = new BlogTools(ghlClient);
const opportunityTools = new OpportunityTools(ghlClient);
const calendarTools = new CalendarTools(ghlClient);
const emailTools = new EmailTools(ghlClient);
const locationTools = new LocationTools(ghlClient);
const emailISVTools = new EmailISVTools(ghlClient);
const socialMediaTools = new SocialMediaTools(ghlClient);
const mediaTools = new MediaTools(ghlClient);
const objectTools = new ObjectTools(ghlClient);
const associationTools = new AssociationTools(ghlClient);
const customFieldV2Tools = new CustomFieldV2Tools(ghlClient);
const workflowTools = new WorkflowTools(ghlClient);
const surveyTools = new SurveyTools(ghlClient);
const storeTools = new StoreTools(ghlClient);
const productsTools = new ProductsTools(ghlClient);

const allTools = [
  ...contactTools.getToolDefinitions(),
  ...conversationTools.getToolDefinitions(),
  ...blogTools.getToolDefinitions(),
  ...opportunityTools.getToolDefinitions(),
  ...calendarTools.getToolDefinitions(),
  ...emailTools.getToolDefinitions(),
  ...locationTools.getToolDefinitions(),
  ...emailISVTools.getToolDefinitions(),
  ...socialMediaTools.getTools(),
  ...mediaTools.getToolDefinitions(),
  ...objectTools.getToolDefinitions(),
  ...associationTools.getTools(),
  ...customFieldV2Tools.getTools(),
  ...workflowTools.getTools(),
  ...surveyTools.getTools(),
  ...storeTools.getTools(),
  ...productsTools.getTools()
];

// OAuth endpoints for Claude.ai
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  const base = 'https://' + req.get('host');
  res.json({
    resource: base,
    authorization_servers: [base],
    bearer_methods_supported: ['header']
  });
});

app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
  const base = 'https://' + req.get('host');
  res.json({
    resource: base + '/mcp',
    authorization_servers: [base],
    bearer_methods_supported: ['header']
  });
});

app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const base = 'https://' + req.get('host');
  res.json({
    issuer: base,
    authorization_endpoint: base + '/oauth/authorize',
    token_endpoint: base + '/oauth/token',
    registration_endpoint: base + '/oauth/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none']
  });
});

app.post('/oauth/register', (req, res) => {
  res.status(201).json({
    client_id: 'ghl-mcp-client',
    client_secret: 'ghl-mcp-secret',
    redirect_uris: req.body.redirect_uris || [],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none'
  });
});

app.get('/oauth/authorize', (req, res) => {
  const { redirect_uri, state } = req.query;
  console.log(`[OAuth] Authorize - redirect_uri: ${redirect_uri}, state: ${state}`);
  res.redirect(`${redirect_uri}?code=ghl-mcp-code&state=${state}`);
});

app.post('/oauth/token', (req, res) => {
  console.log('[OAuth] Token request received');
  res.json({
    access_token: 'ghl-mcp-token',
    token_type: 'bearer',
    expires_in: 86400,
    scope: 'mcp'
  });
});

// Streamable HTTP MCP endpoint
const transports = new Map<string, StreamableHTTPServerTransport>();

app.all('/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string;

    if (req.method === 'POST' && !sessionId) {
      // New session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => Math.random().toString(36).substring(2),
        onsessioninitialized: (id) => {
          transports.set(id, transport);
          console.log(`[MCP] New session: ${id}`);
        }
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
          console.log(`[MCP] Session closed: ${transport.sessionId}`);
        }
      };

      const server = new McpServer({
        name: 'ghl-mcp-server',
        version: '1.0.0'
      });

      // Register all tools
      for (const tool of allTools) {
        server.tool(tool.name, tool.description || '', tool.inputSchema?.properties || {}, async (args: any) => {
          const result = await routeTool(tool.name, args);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        });
      }

      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    res.status(400).json({ error: 'Invalid or missing session' });
  } catch (error) {
    console.error('[MCP] Error:', error);
    if (!res.headersSent) res.status(500).json({ error: String(error) });
  }
});

async function routeTool(name: string, args: any): Promise<any> {
  if (contactTools.getToolDefinitions().find((t: any) => t.name === name)) return contactTools.executeTool(name, args);
  if (conversationTools.getToolDefinitions().find((t: any) => t.name === name)) return conversationTools.executeTool(name, args);
  if (blogTools.getToolDefinitions().find((t: any) => t.name === name)) return blogTools.executeTool(name, args);
  if (opportunityTools.getToolDefinitions().find((t: any) => t.name === name)) return opportunityTools.executeTool(name, args);
  if (calendarTools.getToolDefinitions().find((t: any) => t.name === name)) return calendarTools.executeTool(name, args);
  if (emailTools.getToolDefinitions().find((t: any) => t.name === name)) return emailTools.executeTool(name, args);
  if (locationTools.getToolDefinitions().find((t: any) => t.name === name)) return locationTools.executeTool(name, args);
  if (emailISVTools.getToolDefinitions().find((t: any) => t.name === name)) return emailISVTools.executeTool(name, args);
  if (socialMediaTools.getTools().find((t: any) => t.name === name)) return socialMediaTools.executeTool(name, args);
  if (mediaTools.getToolDefinitions().find((t: any) => t.name === name)) return mediaTools.executeTool(name, args);
  if (objectTools.getToolDefinitions().find((t: any) => t.name === name)) return objectTools.executeTool(name, args);
  if (associationTools.getTools().find((t: any) => t.name === name)) return associationTools.executeAssociationTool(name, args);
  if (customFieldV2Tools.getTools().find((t: any) => t.name === name)) return customFieldV2Tools.executeCustomFieldV2Tool(name, args);
  if (workflowTools.getTools().find((t: any) => t.name === name)) return workflowTools.executeWorkflowTool(name, args);
  if (surveyTools.getTools().find((t: any) => t.name === name)) return surveyTools.executeSurveyTool(name, args);
  if (storeTools.getTools().find((t: any) => t.name === name)) return storeTools.executeStoreTool(name, args);
  if (productsTools.getTools().find((t: any) => t.name === name)) return productsTools.executeProductsTool(name, args);
  throw new Error(`Unknown tool: ${name}`);
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', server: 'ghl-mcp-server', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: 'GoHighLevel MCP Server',
version: '1.0.0',
    status: 'running',
    endpoints: { health: '/health', mcp: '/mcp', oauth: '/.well-known/oauth-authorization-server' }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log('✅ GoHighLevel MCP Streamable HTTP Server started!');
  console.log(`🌐 Server: http://0.0.0.0:${port}`);
  console.log(`🔗 MCP Endpoint: http://0.0.0.0:${port}/mcp`);
  console.log(`📋 Tools: ${allTools.length}`);
  console.log('🎯 Ready for Claude.ai integration!');
});

process.on('SIGINT', () => { console.log('\nShutting down...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\nShutting down...'); process.exit(0); });
