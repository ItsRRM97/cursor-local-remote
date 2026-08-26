import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { spawnAgent, classifyAgentStartError } from "@/lib/cursor-cli";
import { getWorkspace } from "@/lib/workspace";
import { resolveAgentWorkspace } from "@/lib/mcp-workspace";
import { upsertSession } from "@/lib/session-store";
import { registerProcess, promoteToSessionId, pushLiveEvent, setProcessExitHook } from "@/lib/process-registry";
import { chatRequestSchema, parseBody } from "@/lib/validation";
import { badRequest, serverError, safeErrorMessage, parseJsonBody } from "@/lib/errors";
import { AGENT_INIT_TIMEOUT_MS } from "@/lib/constants";
import { notifyAgentComplete } from "@/lib/webhooks";
import type { ChatRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

setProcessExitHook((sessionId, workspace) => {
  void notifyAgentComplete(sessionId, workspace);
});

export async function POST(req: Request) {
  const raw = await parseJsonBody<ChatRequest>(req);
  if (raw instanceof Response) return raw;

  const parsed = parseBody(chatRequestSchema, raw);
  if ("error" in parsed) return badRequest(parsed.error);
  const body = parsed.data;

  const requested = body.workspace || getWorkspace();
  const workspace = await resolveAgentWorkspace(requested);

  try {
    const requestId = randomUUID();

    if (workspace !== resolve(requested) && process.env.CLR_VERBOSE === "1") {
      console.warn(`[chat] MCP workspace fallback: ${requested} -> ${workspace}`);
    }

    const spawned = await spawnAgent({
      prompt: body.prompt,
      sessionId: body.sessionId,
      workspace,
      model: body.model,
      mode: body.mode,
    });

    registerProcess(requestId, spawned.child, workspace);

    if (body.sessionId) {
      promoteToSessionId(requestId, body.sessionId);
    }

    const verbose = process.env.CLR_VERBOSE === "1";

    if (verbose) {
      console.warn(`[chat] spawning agent in ${workspace} (model=${body.model ?? "default"}, mode=${body.mode ?? "agent"})`);
    }

    let liveSessionId = body.sessionId ?? null;
    const sessionId = await spawned.waitForSessionId(AGENT_INIT_TIMEOUT_MS, (event) => {
      const eventSessionId = typeof event.session_id === "string" ? event.session_id : null;
      if (!liveSessionId && eventSessionId) {
        liveSessionId = eventSessionId;
        void upsertSession(eventSessionId, workspace, body.prompt);
        promoteToSessionId(requestId, eventSessionId);
      }
      if (
        liveSessionId &&
        (event.type === "user" || event.type === "assistant" || event.type === "tool_call")
      ) {
        pushLiveEvent(liveSessionId, event);
      }
    });

    if (!sessionId) {
      spawned.child.kill("SIGTERM");
      const timedOut = spawned.child.exitCode === null;
      const message = classifyAgentStartError(spawned.stderr(), timedOut);
      console.error("[chat] agent did not start:", message);
      return serverError(message);
    }

    void upsertSession(sessionId, workspace, body.prompt);
    promoteToSessionId(requestId, sessionId);

    if (verbose) {
      console.warn(`[chat] agent started session ${sessionId}`);
    }

    return Response.json({ sessionId });
  } catch (err) {
    safeErrorMessage(err, "Failed to start agent");
    return serverError("Failed to start agent");
  }
}
