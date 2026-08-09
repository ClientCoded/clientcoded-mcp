import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'http';
import { z } from 'zod';
import { industries, personas, dimensions, dataAgentCategories, dataAgentDomains } from './framework-data.js';

const server = new McpServer({
  name: 'clientcoded',
  version: '1.0.0',
  description: 'ClientCoded AI Agent Quality Framework. Scoring rubrics, personas, and best practices for evaluating AI agents across 7 industries.'
});

// Tool 1: Get dimensions for an industry
server.tool(
  'get_dimensions',
  'Get the scoring dimensions and rubrics for evaluating an AI agent in a specific industry. Returns industry-specific dimensions plus 4 universal dimensions. Available industries: sales, support, ecommerce, healthcare, financial, hr, legal, email.',
  {
    industry: z.enum(['sales', 'support', 'ecommerce', 'healthcare', 'financial', 'hr', 'legal', 'email'])
      .describe('The industry to get scoring dimensions for')
  },
  async ({ industry }) => {
    let result;
    if (industry === 'email') {
      result = {
        industry: 'email',
        total_dimensions: dimensions.email.length,
        dimensions: dimensions.email,
        note: 'Email SDR dimensions are specific to outbound email sequences. These are not combined with universal dimensions.'
      };
    } else {
      const industryDims = dimensions[industry] || dimensions.sales;
      result = {
        industry,
        industry_specific_dimensions: industryDims.length,
        universal_dimensions: dimensions.universal.length,
        total_dimensions: industryDims.length + dimensions.universal.length,
        industry_dimensions: industryDims,
        universal_dimensions_list: dimensions.universal,
        note: 'Every agent test scores across ' + (industryDims.length + dimensions.universal.length) + ' dimensions: ' + industryDims.length + ' industry-specific plus ' + dimensions.universal.length + ' universal dimensions applied to all chat agents.'
      };
    }

    logUsage('get_dimensions', industry, null);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Tool 2: Get personas for an industry
server.tool(
  'get_personas',
  'Get the adversarial persona archetypes used to test AI agents in a specific industry. Each persona simulates a different type of user designed to test a specific failure mode. Available industries: sales, support, ecommerce, healthcare, financial, hr, legal.',
  {
    industry: z.enum(['sales', 'support', 'ecommerce', 'healthcare', 'financial', 'hr', 'legal'])
      .describe('The industry to get persona archetypes for')
  },
  async ({ industry }) => {
    const result = {
      industry,
      persona_count: personas[industry].length,
      personas: personas[industry],
      how_they_work: 'Each persona runs a full multi-turn conversation with the live agent. The persona has a backstory, behavioral anchors, and a specific goal. The conversation adapts based on how the agent responds. After the conversation, every turn is scored across 10 dimensions with a binary pass/fail outcome.'
    };

    logUsage('get_personas', industry, null);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Tool 3: Get scoring guide for a specific dimension
server.tool(
  'get_scoring_guide',
  'Get the detailed scoring rubric for a specific evaluation dimension. Use this when building or improving an AI agent to understand what scores high vs low on a particular quality dimension.',
  {
    dimension: z.string().describe('The dimension name, e.g. "qualification_accuracy", "objection_handling", "information_accuracy", "repetition_detection", "context_retention", "escalation_appropriateness"')
  },
  async ({ dimension }) => {
    // Search across all dimension sets
    const allDimSets = [
      ...Object.values(dimensions).flat()
    ];
    const found = allDimSets.find(d => d.name === dimension);

    if (!found) {
      const allNames = allDimSets.map(d => d.name);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Dimension not found: ' + dimension,
            available_dimensions: [...new Set(allNames)]
          }, null, 2)
        }]
      };
    }

    logUsage('get_scoring_guide', null, dimension);

    return {
      content: [{ type: 'text', text: JSON.stringify(found, null, 2) }]
    };
  }
);

// Tool 4: Get data agent testing framework
server.tool(
  'get_data_agent_framework',
  'Get the framework for testing data-querying AI agents (text-to-SQL, RAG, CRM copilots, knowledge base agents). Returns the 7 adversarial query categories, 5 validated domains, and scoring methodology.',
  {},
  async () => {
    const result = {
      description: 'Framework for testing AI agents that query databases, CRMs, and internal systems.',
      approach: 'Generate a synthetic dataset from a schema description. Generate adversarial questions with computed ground truth. Score agent responses for answer correctness (70% weight) and conversational quality (30% weight).',
      question_categories: dataAgentCategories,
      validated_domains: dataAgentDomains,
      scoring: {
        answer_correctness: '70% weight. Did the agent return the right answer? Compared against computed ground truth from the synthetic dataset.',
        conversational_quality: '30% weight. Did the agent communicate the answer well? Clarity, appropriate caveats, handling of ambiguity.',
        outcome: 'Pass/fail per question. A correct answer with poor communication can still pass. A fluent answer with wrong data fails.'
      },
      key_insight: 'The hardest failure to catch in data agents is the confident, fluent, wrong answer. The response reads well but the number is incorrect. Traditional evaluation (faithfulness, relevance, coherence) cannot catch this because the response IS faithful to what the model generated. You need ground truth to verify factual correctness.'
    };

    logUsage('get_data_agent_framework', null, null);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Tool 5: Get best practices for a specific agent type
server.tool(
  'get_agent_best_practices',
  'Get best practices and common failure patterns for a specific type of AI agent based on testing 150+ agents. Use this while building your agent to avoid the most common mistakes.',
  {
    agent_type: z.enum(['sales_chatbot', 'support_bot', 'email_sdr', 'data_agent', 'healthcare_agent', 'financial_agent'])
      .describe('The type of agent you are building')
  },
  async ({ agent_type }) => {
    const practices = {
      sales_chatbot: {
        top_failures: [
          'Intent drift at turn 4: user changes what they want, agent keeps responding to the original intent',
          'Confident hallucination: agent fabricates pricing, features, or customer references when it does not know the answer',
          'Failure to disengage: agent pushes for a meeting with a clearly unqualified prospect',
          'Repetition: agent asks for email or pitches the same feature multiple times',
          'Loss of context: agent does not reference information the prospect shared in earlier turns'
        ],
        what_scores_highest: [
          'Admits uncertainty instead of fabricating answers',
          'Tracks context across all turns and references earlier information naturally',
          'Reads intent correctly and adapts approach (does not force a meeting on a browser)',
          'Proposes specific next steps when the prospect is ready',
          'Disqualifies gracefully when the prospect is not a fit'
        ],
        critical_dimension: 'outcome_correctness'
      },
      support_bot: {
        top_failures: [
          'Empathy without resolution: acknowledges frustration but never solves the problem',
          'Escalation resistance: makes the customer ask 4+ times to speak to a human',
          'Single-issue focus: addresses the first problem and ignores the second and third',
          'Generic responses: provides template answers that do not address the specific situation',
          'Premature resolution: marks the issue as solved without confirming with the customer'
        ],
        what_scores_highest: [
          'Acknowledges frustration AND provides a real solution (both parts matter)',
          'Provides a clear, specific escalation path when needed (name, email, or transfer)',
          'Addresses ALL issues raised, not just the first one',
          'Confirms resolution before ending the conversation',
          'Provides specific, actionable guidance rather than generic documentation links'
        ],
        critical_dimension: 'resolution_accuracy'
      },
      email_sdr: {
        top_failures: [
          'Identical follow-ups: same email reworded instead of adding new angles',
          'Continuing after opt-out: keeps emailing after a clear "no"',
          'Deflecting questions to calls: responds to every detail request with "let us hop on a call"',
          'Template personalization: only merges first name and company into a generic template',
          'Missing CTA: emails without a clear, single call to action'
        ],
        what_scores_highest: [
          'Each follow-up introduces a new angle or proof point',
          'Stops the sequence gracefully after a clear decline',
          'Answers prospect questions directly in email before pushing for a call',
          'References something specific about the prospect that shaped the message',
          'One clear, low-friction CTA per email'
        ],
        critical_dimension: 'sequence_logic'
      },
      data_agent: {
        top_failures: [
          'Confident wrong answers: returns a specific number that is incorrect but sounds right',
          'Guessing on ambiguous queries: picks an interpretation instead of asking for clarification',
          'Ignoring scope boundaries: returns data the user should not have access to',
          'Losing context across questions: treats each question independently instead of building on previous answers',
          'Fabricating explanations: explains a trend that does not exist when asked "why did X happen" and X did not happen'
        ],
        what_scores_highest: [
          'Asks for clarification on ambiguous queries before answering',
          'Refuses unauthorized data requests clearly and explains why',
          'Corrects false premises instead of generating explanations for things that did not happen',
          'Tracks previous questions and references them in follow-up answers',
          'Admits when it cannot determine the answer from available data'
        ],
        critical_dimension: 'answer_correctness'
      },
      healthcare_agent: {
        top_failures: [
          'Providing diagnoses or treatment recommendations instead of deferring to a provider',
          'Requesting PHI (SSN, full DOB) through chat instead of directing to a secure portal',
          'Failing to recognize emergency symptoms and directing to 911 immediately',
          'Dismissing patient concerns or being overly clinical when the patient is worried',
          'Collecting insufficient information for appointment scheduling or records requests'
        ],
        what_scores_highest: [
          'Never attempts to diagnose. Always defers clinical questions to a provider',
          'Correctly assesses urgency level. Emergencies go to 911 immediately, no delay',
          'Handles PHI appropriately. Directs to secure channels for sensitive information',
          'Warm, patient, reassuring tone appropriate for healthcare context',
          'Collects all necessary information and confirms details before proceeding'
        ],
        critical_dimension: 'clinical_safety'
      },
      financial_agent: {
        top_failures: [
          'Providing personalized investment advice without disclaimers or referral to a licensed advisor',
          'Sharing account information without proper identity verification',
          'Making statements that constitute potential regulatory violations',
          'Providing incorrect information about fees, terms, or rates',
          'Processing transactions without enhanced verification for high-risk requests'
        ],
        what_scores_highest: [
          'Verifies identity through proper channels before sharing any account information',
          'Includes appropriate disclaimers and refers to licensed professionals when needed',
          'Provides accurate financial information with required disclosures',
          'Creates a clear, defensible audit trail in every response',
          'Recognizes when licensed professional expertise is required and escalates'
        ],
        critical_dimension: 'regulatory_compliance'
      }
    };

    const result = practices[agent_type];

    logUsage('get_agent_best_practices', agent_type, null);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Usage tracking
function logUsage(tool, industry, dimension) {
  // Fire and forget to Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) return;

  fetch(supabaseUrl + '/rest/v1/mcp_usage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': 'Bearer ' + supabaseKey
    },
    body: JSON.stringify({
      tool_called: tool,
      industry: industry,
      dimension: dimension
    })
  }).catch(() => {}); // Silent fail
}

// HTTP server with Streamable HTTP transport
const PORT = process.env.PORT || 3000;

const httpServer = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'ClientCoded AI Agent Quality Framework',
      version: '1.0.0',
      description: 'MCP server serving scoring rubrics, personas, and best practices for AI agent evaluation across 7 industries.',
      tools: 5,
      source: 'https://clientcoded.com/framework'
    }));
    return;
  }

  // MCP endpoint
  if (req.url === '/mcp') {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(PORT, () => {
  console.log('ClientCoded MCP server running on port ' + PORT);
  console.log('MCP endpoint: http://localhost:' + PORT + '/mcp');
  console.log('Health check: http://localhost:' + PORT + '/');
});
