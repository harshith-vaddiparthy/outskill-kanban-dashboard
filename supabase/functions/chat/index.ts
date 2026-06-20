import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task on the Kanban board",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Task description (optional, markdown supported)" },
          column: {
            type: "string",
            enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"],
            description: "Which column/status to place the task in"
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Task priority"
          },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags" },
          due_date: { type: "string", description: "Optional due date in YYYY-MM-DD format" },
        },
        required: ["title", "column", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update one or more fields of an existing task by its ID",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task UUID" },
          title: { type: "string" },
          description: { type: "string" },
          column: { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"] },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          tags: { type: "array", items: { type: "string" } },
          due_date: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_task",
      description: "Move a task to a different column",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task UUID" },
          target_column: {
            type: "string",
            enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"],
            description: "Target column"
          },
        },
        required: ["id", "target_column"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete a task by its ID",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task UUID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "List tasks with optional filters. Use this to read board state before making changes.",
      parameters: {
        type: "object",
        properties: {
          column: { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"] },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          tag: { type: "string" },
          due_before: { type: "string", description: "ISO date string" },
          due_after: { type: "string", description: "ISO date string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_update",
      description: "Update multiple tasks matching criteria in one operation",
      parameters: {
        type: "object",
        properties: {
          criteria: {
            type: "object",
            properties: {
              column: { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"] },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              tag: { type: "string" },
              older_than_days: { type: "number", description: "Tasks created more than N days ago" },
            },
          },
          changes: {
            type: "object",
            properties: {
              column: { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"] },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              tags: { type: "array", items: { type: "string" } },
            },
          },
        },
        required: ["criteria", "changes"],
      },
    },
  },
];

async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<unknown> {
  switch (toolName) {
    case "create_task": {
      const colTasks = await supabase
        .from("tasks")
        .select("order_index")
        .eq("user_id", userId)
        .eq("column_status", args.column as string)
        .order("order_index", { ascending: false })
        .limit(1);
      const nextIndex = colTasks.data && colTasks.data.length > 0 ? colTasks.data[0].order_index + 1 : 0;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: args.title,
          description: args.description ?? null,
          column_status: args.column,
          priority: args.priority,
          tags: args.tags ?? [],
          due_date: args.due_date ?? null,
          order_index: nextIndex,
          user_id: userId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { success: true, task: data };
    }

    case "update_task": {
      const updates: Record<string, unknown> = {};
      if (args.title !== undefined) updates.title = args.title;
      if (args.description !== undefined) updates.description = args.description;
      if (args.column !== undefined) updates.column_status = args.column;
      if (args.priority !== undefined) updates.priority = args.priority;
      if (args.tags !== undefined) updates.tags = args.tags;
      if (args.due_date !== undefined) updates.due_date = args.due_date;

      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", args.id as string)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { success: true, task: data };
    }

    case "move_task": {
      const { data, error } = await supabase
        .from("tasks")
        .update({ column_status: args.target_column })
        .eq("id", args.id as string)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { success: true, task: data };
    }

    case "delete_task": {
      // First get the task for confirmation message
      const { data: task } = await supabase
        .from("tasks")
        .select("title")
        .eq("id", args.id as string)
        .eq("user_id", userId)
        .single();

      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", args.id as string)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { success: true, deleted_task_title: task?.title };
    }

    case "list_tasks": {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("order_index");

      if (args.column) query = query.eq("column_status", args.column);
      if (args.priority) query = query.eq("priority", args.priority);
      if (args.tag) query = query.contains("tags", [args.tag]);
      if (args.due_before) query = query.lte("due_date", args.due_before);
      if (args.due_after) query = query.gte("due_date", args.due_after);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { tasks: data, count: data?.length ?? 0 };
    }

    case "bulk_update": {
      const criteria = args.criteria as Record<string, unknown>;
      const changes = args.changes as Record<string, unknown>;

      let query = supabase
        .from("tasks")
        .select("id")
        .eq("user_id", userId);

      if (criteria.column) query = query.eq("column_status", criteria.column);
      if (criteria.priority) query = query.eq("priority", criteria.priority);
      if (criteria.tag) query = query.contains("tags", [criteria.tag]);
      if (criteria.older_than_days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (criteria.older_than_days as number));
        query = query.lte("created_at", cutoff.toISOString());
      }

      const { data: matchingTasks, error: fetchError } = await query;
      if (fetchError) throw new Error(fetchError.message);
      if (!matchingTasks || matchingTasks.length === 0) {
        return { success: true, updated_count: 0 };
      }

      const updates: Record<string, unknown> = {};
      if (changes.column !== undefined) updates.column_status = changes.column;
      if (changes.priority !== undefined) updates.priority = changes.priority;
      if (changes.tags !== undefined) updates.tags = changes.tags;

      const ids = matchingTasks.map((t: { id: string }) => t.id);
      const { error: updateError } = await supabase
        .from("tasks")
        .update(updates)
        .in("id", ids)
        .eq("user_id", userId);
      if (updateError) throw new Error(updateError.message);

      return { success: true, updated_count: ids.length };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authenticate user
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service role client for DB ops
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get settings (including API key)
  const { data: settings } = await supabase
    .from("settings")
    .select("model, openai_api_key")
    .eq("user_id", user.id)
    .single();

  const openaiApiKey = settings?.openai_api_key ?? Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key not configured. Please add your API key in Settings." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { messages } = await req.json();
  const model = settings?.model ?? "gpt-4o";

  const systemPrompt = `You are FlowBoard's AI assistant — a helpful, concise task manager. You help users manage their Kanban board through natural language.

The board has 6 columns: Backlog, To Do, In Progress, In Review, Done, Cancelled.
Priorities: low, medium, high, urgent.

When the user asks you to make changes, use the available tools to do so. After each tool call, confirm what you did in a natural, friendly sentence. Be concise — don't over-explain.

If the user asks you to list tasks, use list_tasks and summarize the results clearly.
For bulk operations, use bulk_update.
Always confirm actions with the task title when possible.

Current date: ${new Date().toISOString().split("T")[0]}`;

  // Streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const openaiMessages = [
          { role: "system", content: systemPrompt },
          ...messages,
        ];

        // Agentic loop
        let iteration = 0;
        const MAX_ITERATIONS = 10;

        while (iteration < MAX_ITERATIONS) {
          iteration++;

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: openaiMessages,
              tools: TOOLS,
              tool_choice: "auto",
              stream: true,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            let errMsg = `OpenAI API error (${response.status})`;
            try {
              const errJson = JSON.parse(errText);
              errMsg = errJson.error?.message ?? errMsg;
            } catch { /* ignore */ }
            send({ type: "error", content: errMsg });
            break;
          }

          // Parse streaming response
          const reader = response.body!.getReader();
          const dec = new TextDecoder();
          let buffer = "";
          let fullContent = "";
          let toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> = [];
          let finishReason = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += dec.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6);
              if (data === "[DONE]") { finishReason = finishReason || "stop"; continue; }

              try {
                const chunk = JSON.parse(data);
                const delta = chunk.choices?.[0]?.delta;
                const chunkFinish = chunk.choices?.[0]?.finish_reason;
                if (chunkFinish) finishReason = chunkFinish;

                if (delta?.content) {
                  fullContent += delta.content;
                  send({ type: "text", content: delta.content });
                }

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (tc.index !== undefined) {
                      if (!toolCalls[tc.index]) {
                        toolCalls[tc.index] = {
                          id: tc.id ?? "",
                          type: "function",
                          function: { name: tc.function?.name ?? "", arguments: "" },
                        };
                      }
                      if (tc.id) toolCalls[tc.index].id = tc.id;
                      if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                      if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                  }
                }
              } catch { /* ignore */ }
            }
          }

          // Add assistant message to conversation
          const assistantMsg: Record<string, unknown> = { role: "assistant" };
          if (fullContent) assistantMsg.content = fullContent;
          if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
          openaiMessages.push(assistantMsg);

          // If there are tool calls, execute them
          if (toolCalls.length > 0 && finishReason === "tool_calls") {
            for (const toolCall of toolCalls) {
              let toolResult: unknown;
              try {
                const args = JSON.parse(toolCall.function.arguments);
                toolResult = await executeToolCall(toolCall.function.name, args, supabase, user.id);
                send({ type: "tool_result", tool: toolCall.function.name, result: toolResult });
              } catch (err) {
                toolResult = { error: (err as Error).message };
                send({ type: "tool_error", tool: toolCall.function.name, error: (err as Error).message });
              }

              openaiMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult),
              });
            }
            // Continue loop to get final assistant response
            continue;
          }

          // No more tool calls, we're done
          break;
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        send({ type: "error", content: (err as Error).message });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
