# Tool Calling Patterns

## Defining Tools with `tool()` Function

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Simple tool
const searchTool = tool(
  async ({ query }) => {
    const results = await searchAPI.search(query);
    return JSON.stringify(results);
  },
  {
    name: "search",
    description: "Search for information on the web",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

// Tool with complex schema
const createEventTool = tool(
  async ({ title, date, attendees, location }) => {
    const event = await calendar.createEvent({
      title,
      date: new Date(date),
      attendees,
      location,
    });
    return JSON.stringify({ eventId: event.id, status: "created" });
  },
  {
    name: "create_event",
    description: "Create a calendar event",
    schema: z.object({
      title: z.string().describe("Event title"),
      date: z.string().describe("ISO 8601 date string"),
      attendees: z.array(z.string().email()).describe("List of attendee emails"),
      location: z.string().optional().describe("Event location"),
    }),
  }
);
```

## Using DynamicStructuredTool

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const calculatorTool = new DynamicStructuredTool({
  name: "calculator",
  description: "Perform mathematical calculations",
  schema: z.object({
    expression: z.string().describe("Mathematical expression"),
  }),
  func: async ({ expression }) => {
    // Use a safe math library like mathjs
    const math = await import("mathjs");
    try {
      const result = math.evaluate(expression);
      return String(result);
    } catch {
      return "Error: Invalid expression";
    }
  },
});
```

## Binding Tools to Model

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({ model: "gpt-4-turbo" });

// Bind tools
const modelWithTools = model.bindTools([searchTool, calculatorTool]);

// Force tool use
const modelForcedTool = model.bindTools([searchTool], {
  tool_choice: { type: "function", function: { name: "search" } },
});

// Parallel tool calling (default for GPT-4)
const response = await modelWithTools.invoke([
  { role: "user", content: "What's the weather in Tokyo and calculate 2^10" },
]);
// May return multiple tool_calls
```

## ToolNode for LangGraph

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

const tools = [searchTool, calculatorTool, createEventTool];
const toolNode = new ToolNode(tools);

// In graph
const workflow = new StateGraph(AgentState)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");
```

## Manual Tool Execution

```typescript
import { ToolMessage } from "@langchain/core/messages";

async function executeTools(toolCalls: ToolCall[]) {
  const toolMap = new Map(tools.map((t) => [t.name, t]));
  const results: ToolMessage[] = [];

  for (const call of toolCalls) {
    const tool = toolMap.get(call.name);
    if (!tool) {
      results.push(
        new ToolMessage({
          tool_call_id: call.id,
          content: `Tool ${call.name} not found`,
        })
      );
      continue;
    }

    try {
      const result = await tool.invoke(call.args);
      results.push(
        new ToolMessage({
          tool_call_id: call.id,
          content: typeof result === "string" ? result : JSON.stringify(result),
        })
      );
    } catch (error) {
      results.push(
        new ToolMessage({
          tool_call_id: call.id,
          content: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
        })
      );
    }
  }

  return results;
}
```

## Structured Output (Tool-like)

```typescript
import { z } from "zod";

const analysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  confidence: z.number().min(0).max(1),
  topics: z.array(z.string()),
  summary: z.string(),
});

const structuredModel = model.withStructuredOutput(analysisSchema);

const result = await structuredModel.invoke(
  "Analyze this review: The product is amazing!"
);
// result is typed: { sentiment, confidence, topics, summary }
```

## Tool Error Handling

```typescript
const robustTool = tool(
  async ({ query }) => {
    try {
      const result = await riskyOperation(query);
      return JSON.stringify({ success: true, data: result });
    } catch (error) {
      // Return error as string so model can handle it
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        suggestion: "Try rephrasing the query",
      });
    }
  },
  {
    name: "risky_operation",
    description: "Performs an operation that might fail",
    schema: z.object({
      query: z.string(),
    }),
  }
);
```

## Tool with Side Effects Confirmation

```typescript
const deleteFileTool = tool(
  async ({ path, confirmed }) => {
    if (!confirmed) {
      return JSON.stringify({
        status: "confirmation_required",
        message: `Are you sure you want to delete ${path}?`,
        confirmWith: { path, confirmed: true },
      });
    }

    await fs.unlink(path);
    return JSON.stringify({ status: "deleted", path });
  },
  {
    name: "delete_file",
    description: "Delete a file (requires confirmation)",
    schema: z.object({
      path: z.string().describe("File path to delete"),
      confirmed: z.boolean().default(false).describe("Set to true to confirm"),
    }),
  }
);
```

## Best Practices

1. **Clear descriptions** - LLM uses these to decide when to call
2. **Zod schemas** - Always use for type safety and validation
3. **Return JSON strings** - Easier for LLM to parse
4. **Handle errors gracefully** - Return error info, don't throw
5. **Limit tool count** - 5-10 tools max for best performance
6. **Test with edge cases** - Invalid inputs, network failures
7. **Log tool usage** - Track which tools are called and why
