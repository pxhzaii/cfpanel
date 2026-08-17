/**
 * CFpanel API 代理（[[proxy]]）
 * 把浏览器请求转发给 Cloudflare API v4，服务端持有 CF_API_TOKEN，前端不暴露 Token。
 */
import type { ApiFunction } from "../../_types";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** 恒定时间比较，防时序侧信道 */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export const onRequest: ApiFunction = async ({ request, env, params }) => {
  // 1. 服务端配置检查
  if (!env.CF_API_TOKEN) {
    return json(
      { success: false, error: "服务端未配置 CF_API_TOKEN，请在 Cloudflare Pages 设置环境变量后重新部署。" },
      500
    );
  }

  // 2. 访问口令校验（每个请求都校验，会话过期即失效）
  const pass = request.headers.get("X-Panel-Pass") ?? "";
  if (!env.PANEL_PASSWORD || !safeEqual(pass, env.PANEL_PASSWORD)) {
    return json({ success: false, error: "访问口令错误，请重新登录。" }, 401);
  }

  // 3. 拼装目标地址
  const raw = Array.isArray(params.proxy) ? params.proxy.join("/") : (params.proxy ?? "");
  const path = raw.split("/").filter(Boolean).join("/");
  const url = new URL(request.url);
  const target = `${CF_API_BASE}/${path}${url.search}`;

  // 4. 只允许转发到 api.cloudflare.com 域内，防 SSRF
  if (!target.startsWith(`${CF_API_BASE}/`)) {
    return json({ success: false, error: "非法路径。" }, 400);
  }

  const method = request.method.toUpperCase();
  if (!["GET", "POST", "DELETE", "PATCH", "PUT"].includes(method)) {
    return json({ success: false, error: `不支持的方法：${method}` }, 405);
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${env.CF_API_TOKEN}`);
  headers.set("Content-Type", "application/json");

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.text();
  }

  try {
    const upstream = await fetch(target, { method, headers, body });
    // 用 arrayBuffer 读取，避免 text() 损坏二进制内容（如图片）
    const buf = await upstream.arrayBuffer();
    const out = new Headers();
    out.set("Content-Type", upstream.headers.get("Content-Type") ?? "application/json");
    // 透传分页相关响应头
    for (const key of ["total", "per_page", "page", "count"]) {
      const v = upstream.headers.get(key);
      if (v) out.set(key, v);
    }
    return new Response(buf, { status: upstream.status, headers: out });
  } catch (e) {
    return json({ success: false, error: `Cloudflare API 请求失败：${(e as Error).message}` }, 502);
  }
};