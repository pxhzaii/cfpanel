/**
 * /api/redeploy — 通过 GitHub API 推送 commit 触发 CF Pages webhook 部署。
 *
 * CF Pages 无论是 ad_hoc 还是 GitHub webhook 部署，都会用部署记录中的
 * env_vars 快照覆盖项目级 env_vars。环境变量恢复逻辑由前端 client.ts
 * 在部署完成后执行（轮询部署状态 → PATCH 恢复）。
 *
 * 需要在 Pages 环境变量中配置 GH_TOKEN（GitHub Token，需 repo 权限）。
 */
import type { ApiFunction } from "../_types";

interface Env extends Environment {
  GH_TOKEN?: string;
}

interface ProjectConfig {
  source?: { type: string; config?: { owner?: string; repo_name?: string; production_branch?: string } };
}

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function parseUsers(env: Environment): { username: string; password: string }[] {
  if (env.PANEL_USERS) {
    try {
      const users = JSON.parse(env.PANEL_USERS);
      if (Array.isArray(users) && users.length > 0) return users;
    } catch { /* */ }
  }
  return [];
}

export const onRequest: ApiFunction = async ({ request, env }) => {
  // 1. 鉴权
  if (!env.CF_API_TOKEN) {
    return json({ success: false, error: "服务端未配置 CF_API_TOKEN。" }, 500);
  }
  const users = parseUsers(env);
  if (users.length === 0) {
    return json({ success: false, error: "服务端未配置面板用户。" }, 500);
  }
  const reqUser = request.headers.get("X-Panel-User") ?? "";
  const reqPass = request.headers.get("X-Panel-Pass") ?? "";
  if (!reqUser || !reqPass) {
    return json({ success: false, error: "请先登录。" }, 401);
  }
  const matched = users.find((u) => safeEqual(reqUser, u.username) && safeEqual(reqPass, u.password));
  if (!matched) {
    return json({ success: false, error: "用户名或密码错误。" }, 401);
  }

  // 2. 解析请求体
  let body: { projectName?: string; accountId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "请求体格式错误。" }, 400);
  }
  const projectName = body.projectName;
  const accountId = body.accountId;
  if (!projectName || !accountId) {
    return json({ success: false, error: "缺少 projectName 或 accountId。" }, 400);
  }

  // 3. CF API 请求头
  const cfHeaders: HeadersInit = {
    "Authorization": `Bearer ${env.CF_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  // 4. 获取 Pages 项目信息（GitHub 仓库 owner/repo/branch）
  let projData: ProjectConfig;
  try {
    const resp = await fetch(`${CF_API_BASE}/accounts/${accountId}/pages/projects/${projectName}`, {
      headers: cfHeaders,
    });
    const raw = await resp.json() as { success: boolean; result?: ProjectConfig; errors?: { message: string }[] };
    if (!resp.ok || !raw.success) {
      return json({ success: false, error: raw.errors?.[0]?.message ?? `获取项目信息失败（HTTP ${resp.status}）` }, resp.status);
    }
    projData = raw.result ?? {};
  } catch (e) {
    return json({ success: false, error: `获取项目信息失败：${(e as Error).message}` }, 502);
  }

  // 5. 检查是否为 GitHub 源
  const src = projData.source;
  if (!src || src.type !== "github" || !src.config?.owner || !src.config?.repo_name) {
    return json({ success: false, error: "该项目未连接 GitHub 仓库，无法通过推 commit 触发部署。" }, 400);
  }
  const owner = src.config.owner;
  const repo = src.config.repo_name;
  const branch = src.config.production_branch ?? "main";

  // 6. 检查 GH_TOKEN
  if (!env.GH_TOKEN) {
    return json({ success: false, error: "服务端未配置 GH_TOKEN 环境变量，无法推送 commit。" }, 500);
  }

  const ghHeaders: HeadersInit = {
    "Authorization": `token ${env.GH_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "cfpanel-redeploy",
  };

  try {
    // 7. 用 Contents API 推送/更新 .redeploy-trigger 文件触发 GitHub webhook
    const triggerPath = ".redeploy-trigger";
    const content = btoa(`redeploy ${Date.now()}`);

    let createResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${triggerPath}`, {
      method: "PUT",
      headers: ghHeaders,
      body: JSON.stringify({
        message: `chore: trigger redeploy via cfpanel`,
        content,
      }),
    });

    // 如果文件已存在（409 / 422），需要先获取文件 sha 再更新
    if (!createResp.ok && (createResp.status === 409 || createResp.status === 422)) {
      const getResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${triggerPath}`, {
        headers: ghHeaders,
      });
      if (!getResp.ok) {
        const errBody = await getResp.text();
        return json({ success: false, error: `获取触发文件信息失败：${errBody.slice(0, 200)}` }, getResp.status);
      }
      const fileData = await getResp.json() as { sha: string };
      createResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${triggerPath}`, {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: `chore: trigger redeploy via cfpanel`,
          content,
          sha: fileData.sha,
        }),
      });
    }

    if (!createResp.ok) {
      const errBody = await createResp.text();
      return json({ success: false, error: `推送触发文件失败：${errBody.slice(0, 200)}` }, createResp.status);
    }

    const result = await createResp.json() as { commit: { sha: string } };
    const commitSha = result.commit.sha;

    return json({
      success: true,
      commit_sha: commitSha,
      message: `已推送 commit 到 ${owner}/${repo}@${branch}，CF Pages 将自动部署。`,
    });
  } catch (e) {
    return json({ success: false, error: `GitHub API 请求失败：${(e as Error).message}` }, 502);
  }
};
