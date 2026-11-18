# Ask DeepWiki

DeepWiki indexes [agent-CI-Infra/bot](https://github.com/agent-CI-Infra/bot), the upstream behind LaunchPad, and answers with links back to the source. It is a third-party, model-generated index; these docs and the repository are canonical.

## Two ways to ask

- **Use the corner widget.** The `Ask DeepWiki` button at the bottom-right opens a panel. **Chat** asks without leaving the page; **Open page** jumps to the DeepWiki page. The widget calls DeepWiki's public MCP endpoint directly — no key, no backend, and no question leaves the browser except to DeepWiki.
- **Use your agent.** Connect the same MCP server to Claude Code, Codex, OpenCode or DeepSeek Harness and ask from inside your agent.

## Ask from your agent (MCP)

DeepWiki exposes a free, no-authentication MCP server at `https://mcp.deepwiki.com/mcp` (streamable HTTP). The endpoint is CORS-enabled, which is why the corner widget can call it from a static page.

```sh
claude mcp add -s user -t http deepwiki https://mcp.deepwiki.com/mcp
```

For a client that reads JSON:

```json
{
  "mcpServers": {
    "deepwiki": { "url": "https://mcp.deepwiki.com/mcp" }
  }
}
```

Available tools: `ask_wiki_question`, `read_wiki_structure`, `read_wiki_contents`.

## Good questions to start with

- How does a task move from an issue to a release?
- What does one repository's virtual computer isolate?
- How are GitHub App credentials scoped per repository?
- What governance gap matters most in the independent analysis?

DeepWiki is best for "where is this in the code" and "how does this mechanism work". For the task lifecycle, see [Lifecycle](lifecycle.md); for the isolation boundary, see [Architecture](architecture.md); for the risk list, see [Analysis](analysis.md).

## It can be wrong

DeepWiki is an external service. Verify a load-bearing answer against the source link it returns, or against these docs. If a page is missing or stale, open [the DeepWiki page](https://deepwiki.com/agent-CI-Infra/bot) once to refresh its index.

## Index status

DeepWiki indexes `agent-CI-Infra/bot` (the upstream behind LaunchPad). The corner widget asks this repository directly.
