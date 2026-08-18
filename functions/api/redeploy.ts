/**
 * /api/redeploy — 通过 GitHub API 推送空 commit 触发 CF Pages webhook 部署。
 *
 * ad_hoc 部署（POST /pages/projects/{name}/deployments）不继承环境变量，
 * 会用空 env_vars 覆盖项目级配置。改用推空 commit 的方式触发
 * GitHub webhook 部署，这种部署会正确继承所有环境变量和绑定。
 *
 * 需要在 Pages 环境变量中配置 GH_TOKEN（GitHub Token）。
 */
import type { ApiFunction } from "../_types";

interface Env extends Environment {
  GH_TOKEN?: string;
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

export const onRequest: ApiFunction = async ({ request, env }: { request: Request; env: Env; params: Record<string, unknown> }) => {
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

  // 3. 通过 CF API 获取 Pages 项目信息（GitHub 仓库 owner/repo/branch）
  const cfHeaders: HeadersInit = {
    "Authorization": `Bearer ${env.CF_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  let projData: {
    source?: { type: string; config?: { owner?: string; repo_name?: string; production_branch?: string } };
  };
  try {
    const resp = await fetch(`${CF_API_BASE}/accounts/${accountId}/pages/projects/${projectName}`, {
      headers: cfHeaders,
    });
    const raw = await resp.json() as { success: boolean; result?: typeof projData; errors?: { message: string }[] };
    if (!resp.ok || !raw.success) {
      return json({ success: false, error: raw.errors?.[0]?.message ?? `获取项目信息失败（HTTP ${resp.status}）` }, resp.status);
    }
    projData = raw.result ?? {};
  } catch (e) {
    return json({ success: false, error: `获取项目信息失败：${(e as Error).message}` }, 502);
  }

  // 4. 检查是否为 GitHub 源
  const src = projData.source;
  if (!src || src.type !== "github" || !src.config?.owner || !src.config?.repo_name) {
    return json({ success: false, error: "该项目未连接 GitHub 仓库，无法通过推 commit 触发部署。" }, 400);
  }
  const owner = src.config.owner;
  const repo = src.config.repo_name;
  const branch = src.config.production_branch ?? "main";

  // 5. 检查 GH_TOKEN
  if (!env.GH_TOKEN) {
    return json({ success: false, error: "服务端未配置 GH_TOKEN 环境变量，无法推送 commit。" }, 500);
  }

  const ghHeaders: HeadersInit = {
    "Authorization": `token ${env.GH_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  try {
    // 6. 获取 main 分支最新 commit SHA
    const refResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      headers: ghHeaders,
    });
    if (!refResp.ok) {
      const errBody = await refResp.text();
      return json({ success: false, error: `获取 ${branch} 分支 ref 失败：${errBody.slice(0, 200)}` }, refResp.status);
    }
    const refData = await refResp.json() as { object: { sha: string } };
    const headSha = refData.object.sha;

    // 7. 创建新 tree（基于 HEAD tree，无改动 → 空 commit）
    const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({ base_tree: headSha, tree: [] }),
    });
    if (!treeResp.ok) {
      return json({ success: false, error: "创建 tree 失败。" }, treeResp.status);
    }
    const treeData = await treeResp.json() as { sha: string };

    // 8. 创建 commit
    const commitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({
        message: `chore: trigger redeploy via cfpanel [skip ci]`,
        tree: treeData.sha,
        parents: [headSha],
      }),
    });
    if (!commitResp.ok) {
      return json({ success: false, error: "创建 commit 失败。" }, commitResp.status);
    }
    const commitData = await commitResp.json() as { sha: string };

    // 9. 更新 ref 指向新 commit
    const updateResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      headers: ghHeaders,
      body: JSON.stringify({ sha: commitData.sha, force: false }),
    });
    if (!updateResp.ok) {
      return json({ success: false, error: "更新分支 ref 失败。" }, updateResp.status);
    }

    return json({
      success: true,
      commit_sha: commitData.sha,
      message: `已推送空 commit 到 ${owner}/${repo}@${branch}，等待 CF Pages webhook 自动部署。`,
    });
  } catch (e) {
    return json({ success: false, error: `GitHub API 请求失败：${(e as Error).message}` }, 502);
  }
};
