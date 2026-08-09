# ClientCoded MCP Server

AI Agent Quality Framework served via MCP. Developers building AI agents get scoring rubrics, adversarial personas, and best practices inside Claude Code, Cursor, and VS Code.

## What it serves

5 tools, zero API cost:

| Tool | What it returns |
|---|---|
| get_dimensions | All scoring dimensions and rubrics for a given industry |
| get_personas | Adversarial persona archetypes for a given industry |
| get_scoring_guide | Detailed rubric for a specific dimension |
| get_data_agent_framework | Framework for testing data-querying agents |
| get_agent_best_practices | Common failures and best practices by agent type |

## Setup Steps

### Step 1: Create the tracking table in Supabase

Run this in the Supabase SQL editor:

```sql
CREATE TABLE mcp_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_called text,
  industry text,
  dimension text,
  created_at timestamptz DEFAULT now()
);
```

### Step 2: Deploy the server

**Option A: Deploy to Render (free tier, recommended)**

1. Push this folder to a new GitHub repo:
   ```
   cd clientcoded-mcp
   git init
   git add .
   git commit -m "ClientCoded MCP server"
   gh repo create clientcoded-mcp --public --push
   ```

2. Go to render.com, sign up, click "New Web Service"

3. Connect your GitHub repo

4. Settings:
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables:
     - `SUPABASE_URL`: `https://cxkzzstiktcwkksghbmx.supabase.co`
     - `SUPABASE_KEY`: your service role key

5. Deploy. Render gives you a URL like `https://clientcoded-mcp.onrender.com`

**Option B: Deploy to Railway (free tier)**

1. Push to GitHub (same as above)
2. Go to railway.app, connect repo
3. Add environment variables
4. Deploy. Railway gives you a URL.

**Option C: Run locally for testing**

```bash
cd clientcoded-mcp
npm install
SUPABASE_URL=https://cxkzzstiktcwkksghbmx.supabase.co SUPABASE_KEY=your_key npm start
```

### Step 3: Test the health endpoint

```bash
curl https://your-deployed-url.com/
```

Should return:
```json
{
  "name": "ClientCoded AI Agent Quality Framework",
  "version": "1.0.0",
  "tools": 5
}
```

### Step 4: How developers install it

**Claude Code:**
```bash
claude mcp add --transport http clientcoded https://your-deployed-url.com/mcp
```

**Cursor:** Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "clientcoded": {
      "url": "https://your-deployed-url.com/mcp"
    }
  }
}
```

**VS Code (Copilot):** Add to `.vscode/mcp.json`:
```json
{
  "servers": {
    "clientcoded": {
      "url": "https://your-deployed-url.com/mcp"
    }
  }
}
```

### Step 5: Verify it works

In Claude Code, type `/mcp` to see connected servers. Then ask:

```
What dimensions should I score my sales chatbot on?
```

Claude Code will call `get_dimensions` with industry "sales" and return the full rubric.

### Step 6: Add to your website

On clientcoded.com/framework, add an install section:

```
Install the MCP

Get the ClientCoded quality framework inside your IDE.

Claude Code:
claude mcp add --transport http clientcoded https://your-deployed-url.com/mcp

Cursor: Add to .cursor/mcp.json:
{ "mcpServers": { "clientcoded": { "url": "https://your-deployed-url.com/mcp" } } }
```

## Tracking Usage

Every tool call logs to the `mcp_usage` table in Supabase. Check weekly:

```sql
SELECT tool_called, industry, dimension, COUNT(*) as calls, 
       DATE(created_at) as day
FROM mcp_usage 
GROUP BY tool_called, industry, dimension, DATE(created_at)
ORDER BY day DESC, calls DESC;
```

Heavy users querying the same industry repeatedly are building an agent in that industry. Reach out.

## Cost

$0. No LLM calls. Serving static content. The only cost is the hosting platform (free tier on Render or Railway).
