import { getNetworkInfo } from "@/lib/network";
import { getWorkspace } from "@/lib/workspace";
import { isCloudflareAccessTrustEnabled } from "@/lib/cloudflare-access";
import { countMcpTools, resolveAgentWorkspace, countMcpAuthTokens } from "@/lib/mcp-workspace";
import { DEFAULT_PORT } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const info = getNetworkInfo(parseInt(process.env.PORT || String(DEFAULT_PORT), 10));
  const token = process.env.AUTH_TOKEN;
  const publicUrl = process.env.PUBLIC_URL?.trim().replace(/\/$/, "");
  const authUrl = publicUrl || (token ? `${info.url}?token=${token}` : info.url);
  const workspace = getWorkspace();
  const mcpToolCount = await countMcpTools(workspace);
  const mcpWorkspace = await resolveAgentWorkspace(workspace);
  return Response.json({
    ...info,
    publicUrl: publicUrl || null,
    authUrl,
    cloudflareAccess: isCloudflareAccessTrustEnabled(),
    workspace,
    mcpReady: mcpToolCount > 0,
    mcpToolCount,
    mcpAuthCount: await countMcpAuthTokens(workspace),
    mcpWorkspace: mcpWorkspace !== workspace ? mcpWorkspace : null,
  });
}
