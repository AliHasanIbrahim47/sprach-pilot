import { serverConfig } from "@/lib/server-config";

/** Proxies a signed export link so the email can point at the web origin. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const exportId = url.searchParams.get("exportId");
  const token = url.searchParams.get("token");
  if (!exportId || !token) return new Response("Missing download token", { status: 400 });

  const target = new URL(
    `/v1/privacy/exports/${encodeURIComponent(exportId)}/download`,
    serverConfig.apiBaseUrl,
  );
  target.searchParams.set("token", token);
  const response = await fetch(target);
  if (!response.ok || !response.body) {
    return new Response("Download unavailable", { status: response.status });
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="sprachpilot-export.zip"',
    },
  });
}
