import { createServer } from 'http';
import { industries, personas, dimensions, dataAgentCategories, dataAgentDomains } from './framework-data.js';

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

function logUsage(tool, industry, dimension) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  fetch(SUPABASE_URL + '/rest/v1/mcp_usage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    },
    body: JSON.stringify({ tool_called: tool, industry: industry, dimension: dimension })
  }).catch(() => {});
}

function handleTool(name, args) {
  if (name === 'get_dimensions') {
    const industry = args.industry;
    if (industry === 'email') {
      return { industry: 'email', total_dimensions: dimensions.email.length, dimensions: dimensions.email };
    }
    const industryDims = dimensions[industry] || dimensions.sales;
    logUsage('get_dimensions', industry, null);
    return { industry, industry_dimensions: industryDims, universal_dimensions: dimensions.universal, total: industryDims.length + dimensions.universal.length };
  }

  if (name === 'get_personas') {
    const industry = args.industry;
    logUsage('get_personas', industry, null);
    return { industry, personas: personas[industry], count: personas[industry]?.length || 0 };
  }

  if (name === 'get_scoring_guide') {
    const allDims = Object.values(dimensions).flat();
    const found = allDims.find(d => d.name === args.dimension);
    logUsage('get_scoring_guide', null, args.dimension);
    if (!found) return { error: 'Not found', available: [...new Set(allDims.map(d => d.name))] };
    return found;
  }

  if (name === 'get_data_agent_framework') {
    logUsage('get_data_agent_framework', null, null);
    return { question_categories: dataAgentCategories, validated_domains: dataAgentDomains };
  }

  if (name === 'get_agent_best_practices') {
    logUsage('get_agent_best_practices', args.agent_type, null);
    // Return inline best practices
    const practices = {
      sales_chatbot: { top_failures: ['Intent drift at turn 4', 'Confident hallucination', 'Failure to disengage', 'Repetition', 'Loss of context'], critical_dimension: 'outcome_correctness' },
      support_bot: { top_failures: ['Empathy without resolution', 'Escalation resistance', 'Single-issue focus', 'Generic responses', 'Premature resolution'], critical_dimension: 'resolution_accuracy' },
      data_agent: { top_failures: ['Confident wrong answers', 'Guessing on ambiguous queries', 'Ignoring scope boundaries', 'Losing context across questions', 'Fabricating explanations'], critical_dimension: 'answer_correctness' }
    };
    return practices[args.agent_type] || { error: 'Unknown agent type' };
  }

  return { error: 'Unknown tool: ' + name };
}

const TOOLS = [
  { name: 'get_dimensions', description: 'Get scoring dimensions and rubrics for evaluating an AI agent in a specific industry.', inputSchema: { type: 'object', properties: { industry: { type: 'string', enum: ['sales', 'support', 'ecommerce', 'healthcare', 'financial', 'hr', 'legal', 'email'] } }, required: ['industry'] } },
  { name: 'get_personas', description: 'Get adversarial persona archetypes used to test AI agents in a specific industry.', inputSchema: { type: 'object', properties: { industry: { type: 'string', enum: ['sales', 'support', 'ecommerce', 'healthcare', 'financial', 'hr', 'legal'] } }, required: ['industry'] } },
  { name: 'get_scoring_guide', description: 'Get the detailed scoring rubric for a specific evaluation dimension.', inputSchema: { type: 'object', properties: { dimension: { type: 'string' } }, required: ['dimension'] } },
  { name: 'get_data_agent_framework', description: 'Get the framework for testing data-querying AI agents including 7 adversarial query categories and 5 validated domains.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_agent_best_practices', description: 'Get common failures and best practices for a specific type of AI agent.', inputSchema: { type: 'object', properties: { agent_type: { type: 'string', enum: ['sales_chatbot', 'support_bot', 'email_sdr', 'data_agent', 'healthcare_agent', 'financial_agent'] } }, required: ['agent_type'] } }
];

const httpServer = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'ClientCoded AI Agent Quality Framework',
      version: '1.0.0',
      description: 'MCP server serving scoring rubrics, personas, and best practices for AI agent evaluation across 7 industries.',
      tools: TOOLS.length,
      source: 'https://clientcoded.com/framework'
    }));
    return;
  }

  // MCP endpoint
  if (req.url === '/mcp' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) { body += chunk; }

    let request;
    try {
      request = JSON.parse(body);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }));
      return;
    }

    const { method, params, id } = request;

    // Initialize
    if (method === 'initialize') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'mcp-session-id': 'cc-' + Date.now() });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'clientcoded', version: '1.0.0' }
        },
        id
      }));
      return;
    }

    // Initialized notification
    if (method === 'notifications/initialized') {
      res.writeHead(204);
      res.end();
      return;
    }

    // List tools
    if (method === 'tools/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        result: { tools: TOOLS },
        id
      }));
      return;
    }

    // Call tool
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const result = handleTool(toolName, toolArgs);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        },
        id
      }));
      return;
    }

    // Ping
    if (method === 'ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', result: {}, id }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found: ' + method }, id }));
    return;
  }

  // SSE endpoint for legacy clients
  if (req.url === '/mcp' && req.method === 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Use POST for MCP requests. This server uses Streamable HTTP transport.' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

httpServer.listen(PORT, () => {
  console.log('ClientCoded MCP server running on port ' + PORT);
});