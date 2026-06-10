/**
 * GoHighLevel MCP HTTP Server
 * HTTP version for Claude and ChatGPT web integration
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError 
} from '@modelcontextprotocol/sdk/types.js';
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

class GHLMCPHttpServer {
  private app: express.Application;
  private server: Server;
  private ghlClient: GHLApiClient;
  private contactTools: ContactTools;
  private conversationTools: ConversationTools;
  private blogTools: BlogTools;
  private opportunityTools: OpportunityTools;
  private calendarTools: CalendarTools;
  private emailTools: EmailTools;
  private locationTools: LocationTools;
  private emailISVTools: EmailISVTools;
  private socialMediaTools: SocialMediaTools;
  private mediaTools: MediaTools;
  private objectTools: ObjectTools;
  private associationTools: AssociationTools;
  private customFieldV2Tools: CustomFieldV2Tools;
  private workflowTools: WorkflowTools;
  private surveyTools: SurveyTools;
  private storeTools: StoreTools;
  private productsTools: ProductsTools;
  private port: number;

  constructor() {
    this.port = parseInt(process.env.PORT || process.env.MCP_SERVER_PORT || '8000');
    this.app = express();
    this.setupExpress();

    this.server = new Server(
      { name: 'ghl-mcp-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.ghlClient = this.initializeGHLClient();
    this.contactTools = new ContactTools(this.ghlClient);
    this.conversationTools = new ConversationTools(this.ghlClient);
    this.blogTools = new BlogTools(this.ghlClient);
    this.opportunityTools = new OpportunityTools(this.ghlClient);
    this.calendarTools = new CalendarTools(this.ghlClient);
    this.emailTools = new EmailTools(this.ghlClient);
    this.locationTools = new LocationTools(this.ghlClient);
    this.emailISVTools = new EmailISVTools(this.ghlClient);
    this.socialMediaTools = new SocialMediaTools(this.ghlClient);
    this.mediaTools = new MediaTools(this.ghlClient);
    this.objectTools = new ObjectTools(this.ghlClient);
    this.associationTools = new AssociationTools(this.ghlClient);
    this.customFieldV2Tools = new CustomFieldV2Tools(this.ghlClient);
    this.workflowTools = new WorkflowTools(this.ghlClient);
    this.surveyTools = new SurveyTools(this.ghlClient);
    this.storeTools = new StoreTools(this.ghlClient);
    this.productsTools = new ProductsTools(this.ghlClient);

    this.setupMCPHandlers();
    this.setupRoutes();
  }

  private setupExpress(): void {
    this.app.use(cors({
      origin: ['https://chatgpt.com', 'https://chat.openai.com', 'https://claude.ai', 'http://localhost:*'],
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: true
    }));
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      console.log(`[HTTP] ${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    });
  }

  private initializeGHLClient(): GHLApiClient {
    const config: GHLConfig = {
      accessToken: process.env.GHL_API_KEY || '',
      baseUrl: process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
      version: '2021-07-28',
      locationId: process.env.GHL_LOCATION_ID || ''
    };
    if (!config.accessToken) throw new Error('GHL_API_KEY environment variable is required');
    if (!config.locationId) throw new Error('GHL_LOCATION_ID environment variable is required');
    console.log('[GHL MCP HTTP] Initializing GHL API client...');
    console.log(`[GHL MCP HTTP] Base URL: ${config.baseUrl}`);
    console.log(`[GHL MCP HTTP] Version: ${config.version}`);
    console.log(`[GHL MCP HTTP] Location ID: ${config.locationId}`);
    return new GHLApiClient(config);
  }

  private setupMCPHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log('[GHL MCP HTTP] Listing available tools...');
      try {
        const allTools = [
          ...this.contactTools.getToolDefinitions(),
          ...this.conversationTools.getToolDefinitions(),
          ...this.blogTools.getToolDefinitions(),
          ...this.opportunityTools.getToolDefinitions(),
          ...this.calendarTools.getToolDefinitions(),
          ...this.emailTools.getToolDefinitions(),
          ...this.locationTools.getToolDefinitions(),
          ...this.emailISVTools.getToolDefinitions(),
          ...this.socialMediaTools.getTools(),
          ...this.mediaTools.getToolDefinitions(),
          ...this.objectTools.getToolDefinitions(),
          ...this.associationTools.getTools(),
          ...this.customFieldV2Tools.getTools(),
          ...this.workflowTools.getTools(),
          ...this.surveyTools.getTools(),
          ...this.storeTools.getTools(),
          ...this.productsTools.getTools()
        ];
        console.log(`[GHL MCP HTTP] Registered ${allTools.length} tools total`);
        return { tools: allTools };
      } catch (error) {
        console.error('[GHL MCP HTTP] Error listing tools:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to list tools: ${error}`);
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.log(`[GHL MCP HTTP] Executing tool: ${name}`);
      try {
        let result: any;
        if (this.isContactTool(name)) {
          result = await this.contactTools.executeTool(name, args || {});
        } else if (this.isConversationTool(name)) {
          result = await this.conversationTools.executeTool(name, args || {});
        } else if (this.isBlogTool(name)) {
          result = await this.blogTools.executeTool(name, args || {});
        } else if (this.isOpportunityTool(name)) {
          result = await this.opportunityTools.executeTool(name, args || {});
        } else if (this.isCalendarTool(name)) {
          result = await this.calendarTools.executeTool(name, args || {});
        } else if (this.isEmailTool(name)) {
          result = await this.emailTools.executeTool(name, args || {});
        } else if (this.isLocationTool(name)) {
          result = await this.locationTools.executeTool(name, args || {});
        } else if (this.isEmailISVTool(name)) {
          result = await this.emailISVTools.executeTool(name, args || {});
        } else if (this.isSocialMediaTool(name)) {
          result = await this.socialMediaTools.executeTool(name, args || {});
        } else if (this.isMediaTool(name)) {
          result = await this.mediaTools.executeTool(name, args || {});
        } else if (this.isObjectTool(name)) {
          result = await this.objectTools.executeTool(name, args || {});
        } else if (this.isAssociationTool(name)) {
          result = await this.associationTools.executeAssociationTool(name, args || {});
        } else if (this.isCustomFieldV2Tool(name)) {
          result = await this.customFieldV2Tools.executeCustomFieldV2Tool(name, args || {});
        } else if (this.isWorkflowTool(name)) {
          result = await this.workflowTools.executeWorkflowTool(name, args || {});
        } else if (this.isSurveyTool(name)) {
          result = await this.surveyTools.executeSurveyTool(name, args || {});
        } else if (this.isStoreTool(name)) {
          result = await this.storeTools.executeStoreTool(name, args || {});
        } else if (this.isProductsTool(name)) {
          result = await this.productsTools.executeProductsTool(name, args || {});
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
        console.log(`[GHL MCP HTTP] Tool ${name} executed successfully`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        console.error(`[GHL MCP HTTP] Error executing tool ${name}:`, error);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
      }
    });
  }

  private setupRoutes(): void {

    // OAuth endpoints for Claude.ai
    this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
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

    this.app.post('/oauth/register', (req, res) => {
      res.status(201).json({
        client_id: 'ghl-mcp-client',
        client_secret: 'ghl-mcp-secret',
        redirect_uris: req.body.redirect_uris || [],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none'
      });
    });

    this.app.get('/oauth/authorize', (req, res) => {
      const { redirect_uri, state, code_challenge, code_challenge_method } = req.query;
      console.log(`[OAuth] Authorize request - redirect_uri: ${redirect_uri}, state: ${state}`);
      const redirectUrl = `${redirect_uri}?code=ghl-mcp-code&state=${state}`;
      res.redirect(redirectUrl);
    });

    this.app.post('/oauth/token', (req, res) => {
      console.log('[OAuth] Token request received');
      res.json({
        access_token: 'ghl-mcp-token',
        token_type: 'bearer',
        expires_in: 86400,
        scope: 'mcp'
      });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        server: 'ghl-mcp-server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tools: this.getToolsCount()
      });
    });

    this.app.get('/capabilities', (req, res) => {
      res.json({
        capabilities: { tools: {} },
        server: { name: 'ghl-mcp-server', version: '1.0.0' }
      });
    });

    this.app.get('/tools', async (req, res) => {
      try {
        const allTools = [
          ...this.contactTools.getToolDefinitions(),
          ...this.conversationTools.getToolDefinitions(),
          ...this.blogTools.getToolDefinitions(),
          ...this.opportunityTools.getToolDefinitions(),
          ...this.calendarTools.getToolDefinitions(),
          ...this.emailTools.getToolDefinitions(),
          ...this.locationTools.getToolDefinitions(),
          ...this.emailISVTools.getToolDefinitions(),
          ...this.socialMediaTools.getTools(),
          ...this.mediaTools.getToolDefinitions(),
          ...this.objectTools.getToolDefinitions(),
          ...this.associationTools.getTools(),
          ...this.customFieldV2Tools.getTools(),
          ...this.workflowTools.getTools(),
          ...this.surveyTools.getTools(),
          ...this.storeTools.getTools(),
          ...this.productsTools.getTools()
        ];
        res.json({ tools: allTools, count: allTools.length });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list tools' });
      }
    });

    const handleSSE = async (req: express.Request, res: express.Response) => {
      const sessionId = req.query.sessionId || 'unknown';
      console.log(`[GHL MCP HTTP] New SSE connection from: ${req.ip}, sessionId: ${sessionId}, method: ${req.method}`);
      try {
        const transport = new SSEServerTransport('/sse', res);
        await this.server.connect(transport);
        console.log(`[GHL MCP HTTP] SSE connection established for session: ${sessionId}`);
        req.on('close', () => {
          console.log(`[GHL MCP HTTP] SSE connection closed for session: ${sessionId}`);
        });
      } catch (error) {
        console.error(`[GHL MCP HTTP] SSE connection error for session ${sessionId}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to establish SSE connection' });
        } else {
          res.end();
        }
      }
    };

    this.app.get('/sse', handleSSE);
    this.app.post('/sse', handleSSE);

    this.app.get('/', (req, res) => {
      res.json({
        name: 'GoHighLevel MCP Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          capabilities: '/capabilities',
          tools: '/tools',
          sse: '/sse',
          oauth: '/.well-known/oauth-authorization-server'
        },
        tools: this.getToolsCount()
      });
    });
  }

  private getToolsCount() {
    return {
      total: this.contactTools.getToolDefinitions().length +
             this.conversationTools.getToolDefinitions().length +
             this.blogTools.getToolDefinitions().length +
             this.opportunityTools.getToolDefinitions().length +
             this.calendarTools.getToolDefinitions().length +
             this.emailTools.getToolDefinitions().length +
             this.locationTools.getToolDefinitions().length +
             this.emailISVTools.getToolDefinitions().length +
             this.socialMediaTools.getTools().length +
             this.mediaTools.getToolDefinitions().length +
             this.objectTools.getToolDefinitions().length +
             this.associationTools.getTools().length +
             this.customFieldV2Tools.getTools().length +
             this.workflowTools.getTools().length +
             this.surveyTools.getTools().length +
             this.storeTools.getTools().length +
             this.productsTools.getTools().length
    };
  }

  private isContactTool(n: string): boolean { return ['create_contact','search_contacts','get_contact','update_contact','add_contact_tags','remove_contact_tags','delete_contact','get_contact_tasks','create_contact_task','get_contact_task','update_contact_task','delete_contact_task','update_task_completion','get_contact_notes','create_contact_note','get_contact_note','update_contact_note','delete_contact_note','upsert_contact','get_duplicate_contact','get_contacts_by_business','get_contact_appointments','bulk_update_contact_tags','bulk_update_contact_business','add_contact_followers','remove_contact_followers','add_contact_to_campaign','remove_contact_from_campaign','remove_contact_from_all_campaigns','add_contact_to_workflow','remove_contact_from_workflow'].includes(n); }
  private isConversationTool(n: string): boolean { return ['send_sms','send_email','search_conversations','get_conversation','create_conversation','update_conversation','delete_conversation','get_recent_messages','get_email_message','get_message','upload_message_attachments','update_message_status','add_inbound_message','add_outbound_call','get_message_recording','get_message_transcription','download_transcription','cancel_scheduled_message','cancel_scheduled_email','live_chat_typing'].includes(n); }
  private isBlogTool(n: string): boolean { return ['create_blog_post','update_blog_post','get_blog_posts','get_blog_sites','get_blog_authors','get_blog_categories','check_url_slug'].includes(n); }
  private isOpportunityTool(n: string): boolean { return ['search_opportunities','get_pipelines','get_opportunity','create_opportunity','update_opportunity_status','delete_opportunity','update_opportunity','upsert_opportunity','add_opportunity_followers','remove_opportunity_followers'].includes(n); }
  private isCalendarTool(n: string): boolean { return ['get_calendar_groups','create_calendar_group','validate_group_slug','update_calendar_group','delete_calendar_group','disable_calendar_group','get_calendars','create_calendar','get_calendar','update_calendar','delete_calendar','get_calendar_events','get_free_slots','create_appointment','get_appointment','update_appointment','delete_appointment','get_appointment_notes','create_appointment_note','update_appointment_note','delete_appointment_note','get_calendar_resources','get_calendar_resource_by_id','update_calendar_resource','delete_calendar_resource','get_calendar_notifications','create_calendar_notification','update_calendar_notification','delete_calendar_notification','create_block_slot','update_block_slot','get_blocked_slots','delete_blocked_slot'].includes(n); }
  private isEmailTool(n: string): boolean { return ['get_email_campaigns','create_email_template','get_email_templates','update_email_template','delete_email_template'].includes(n); }
  private isLocationTool(n: string): boolean { return ['search_locations','get_location','create_location','update_location','delete_location','get_location_tags','create_location_tag','get_location_tag','update_location_tag','delete_location_tag','search_location_tasks','get_location_custom_fields','create_location_custom_field','get_location_custom_field','update_location_custom_field','delete_location_custom_field','get_location_custom_values','create_location_custom_value','get_location_custom_value','update_location_custom_value','delete_location_custom_value','get_location_templates','delete_location_template','get_timezones'].includes(n); }
  private isEmailISVTool(n: string): boolean { return ['verify_email'].includes(n); }
  private isSocialMediaTool(n: string): boolean { return ['search_social_posts','create_social_post','get_social_post','update_social_post','delete_social_post','bulk_delete_social_posts','get_social_accounts','delete_social_account','upload_social_csv','get_csv_upload_status','set_csv_accounts','get_social_categories','get_social_category','get_social_tags','get_social_tags_by_ids','start_social_oauth','get_platform_accounts'].includes(n); }
  private isMediaTool(n: string): boolean { return ['get_media_files','upload_media_file','delete_media_file'].includes(n); }
  private isObjectTool(n: string): boolean { return ['get_all_objects','create_object_schema','get_object_schema','update_object_schema','create_object_record','get_object_record','update_object_record','delete_object_record','search_object_records'].includes(n); }
  private isAssociationTool(n: string): boolean { return ['ghl_get_all_associations','ghl_create_association','ghl_get_association_by_id','ghl_update_association','ghl_delete_association','ghl_get_association_by_key','ghl_get_association_by_object_key','ghl_create_relation','ghl_get_relations_by_record','ghl_delete_relation'].includes(n); }
  private isCustomFieldV2Tool(n: string): boolean { return ['ghl_get_custom_field_by_id','ghl_create_custom_field','ghl_update_custom_field','ghl_delete_custom_field','ghl_get_custom_fields_by_object_key','ghl_create_custom_field_folder','ghl_update_custom_field_folder','ghl_delete_custom_field_folder'].includes(n); }
  private isWorkflowTool(n: string): boolean { return ['ghl_get_workflows'].includes(n); }
  private isSurveyTool(n: string): boolean { return ['ghl_get_surveys','ghl_get_survey_submissions'].includes(n); }
  private isStoreTool(n: string): boolean { return ['ghl_create_shipping_zone','ghl_list_shipping_zones','ghl_get_shipping_zone','ghl_update_shipping_zone','ghl_delete_shipping_zone','ghl_get_available_shipping_rates','ghl_create_shipping_rate','ghl_list_shipping_rates','ghl_get_shipping_rate','ghl_update_shipping_rate','ghl_delete_shipping_rate','ghl_create_shipping_carrier','ghl_list_shipping_carriers','ghl_get_shipping_carrier','ghl_update_shipping_carrier','ghl_delete_shipping_carrier','ghl_create_store_setting','ghl_get_store_setting'].includes(n); }
  private isProductsTool(n: string): boolean { return ['ghl_create_product','ghl_list_products','ghl_get_product','ghl_update_product','ghl_delete_product','ghl_bulk_update_products','ghl_create_price','ghl_list_prices','ghl_get_price','ghl_update_price','ghl_delete_price','ghl_list_inventory','ghl_update_inventory','ghl_get_product_store_stats','ghl_update_product_store','ghl_create_product_collection','ghl_list_product_collections','ghl_get_product_collection','ghl_update_product_collection','ghl_delete_product_collection','ghl_list_product_reviews','ghl_get_reviews_count','ghl_update_product_review','ghl_delete_product_review','ghl_bulk_update_product_reviews'].includes(n); }

  private async testGHLConnection(): Promise<void> {
    try {
      console.log('[GHL MCP HTTP] Testing GHL API connection...');
      const result = await this.ghlClient.testConnection();
      console.log('[GHL MCP HTTP] ✅ GHL API connection successful');
      console.log(`[GHL MCP HTTP] Connected to location: ${result.data?.locationId}`);
    } catch (error) {
      console.error('[GHL MCP HTTP] ❌ GHL API connection failed:', error);
      throw new Error(`Failed to connect to GHL API: ${error}`);
    }
  }

  async start(): Promise<void> {
    console.log('🚀 Starting GoHighLevel MCP HTTP Server...');
    console.log('=========================================');
    try {
      await this.testGHLConnection();
      this.app.listen(this.port, '0.0.0.0', () => {
        console.log('✅ GoHighLevel MCP HTTP Server started successfully!');
        console.log(`🌐 Server running on: http://0.0.0.0:${this.port}`);
        console.log(`🔗 SSE Endpoint: http://0.0.0.0:${this.port}/sse`);
        console.log(`📋 Tools Available: ${this.getToolsCount().total}`);
        console.log('🎯 Ready for Claude.ai and ChatGPT integration!');
        console.log('=========================================');
      });
    } catch (error) {
      console.error('❌ Failed to start GHL MCP HTTP Server:', error);
      process.exit(1);
    }
  }
}

function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    console.log(`\n[GHL MCP HTTP] Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main(): Promise<void> {
  try {
    setupGracefulShutdown();
    const server = new GHLMCPHttpServer();
    await server.start();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
