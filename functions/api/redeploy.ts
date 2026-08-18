/**
 * /api/redeploy — 通过 GitHub API 推送 commit 触发 CF Pages webhook 部署。
 *
 * CF Pages 无论是 ad_hoc 还是 GitHub webhook 部署，都会用部署记录中的
 * env_vars 快照覆盖项目级 env_vars。通过 API PATCH 设置的 plain_text
 * 变量在部署后可能丢失。
 *
 * 解决方案：
 *   1. 推 commit 前保存项目级 env_vars + bindings 快照
 *   2. 用 Contents API 推文件触发 GitHub webhook 部署
 *   3. 后台轮询部署状态直到完成（最多 5 分钟）
 *   4. 部署完成后 PATCH 恢复丢失的 env_vars 和 bindings
 *
 * 需要在 Pages 环境变量中配置 GH_TOKEN（GitHub Token，需 repo 权限）。
 */
import type { ApiFunction, ApiContext } from "../_types";

interface Env extends Environment {
  GH_TOKEN?: string;
}

interface PagesEnvVar {
  type: "plain_text" | "secret_text";
  value: string;
}

interface ProjectConfig {
  source?: { type: string; config?: { owner?: string; repo_name?: string; production_branch?: string } };
  deployment_configs?: {
    production?: {
      env_vars?: Record<string, PagesEnvVar>;
      kv_namespaces?: Record<string, unknown>;
      r2_buckets?: Record<string, unknown>;
      d1_databases?: Record<string, unknown>;
    };
  };
}

interface DeploymentResp {
  latest_stage?: { name: string; status: string };
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

/** 轮询部署状态 + 部署后恢复 env_vars/bindings */
async function pollAndRestore(
  cfHeaders: HeadersInit,
  accountId: string,
  projectName: string,
  owner: string,
  repo: string,
  branch: string,
  ghHeaders: HeadersInit,
  savedEnvVars: Record<string, PagesEnvVar>,
  savedKv: Record<string, unknown>,
  savedR2: Record<string, unknown>,
  savedD1: Record<string, unknown>,
): Promise<void> {
  // 等待 CF Pages webhook 触发部署（webhook 有几秒延迟）
  await new Promise((r) => setTimeout(r, 10000));

  // 获取最新部署 ID
  let deployId = "";
  try {
    const resp = await fetch(`${CF_API_BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=1`, {
      headers: cfHeaders,
    });
    const raw = await resp.json() as { success: boolean; result?: DeploymentResp[] };
    if (raw.success && raw.result && raw.result.length > 0) {
      deployId = (raw.result[0] as DeploymentResp & { id: string }).id;
    }
  } catch {
    // 忽略，下面轮询时再获取
  }

  // 轮询部署状态（最多 5 分钟）
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      // 获取最新部署
      const resp = await fetch(`${CF_API_BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=1`, {
        headers: cfHeaders,
      });
      const raw = await resp.json() as { success: boolean; result?: DeploymentResp[] };
      if (raw.success && raw.result && raw.result.length > 0) {
        const latest = raw.result[0];
        const stage = latest.latest_stage;
        if (stage && (stage.status === "success" || stage.status === "failure" || stage.status === "canceled")) {
          break;
        }
      }
    } catch {
      // 继续重试
    }
  }

  // 部署完成后恢复 env_vars 和 bindings
  try {
    const restoreBody: Record<string, unknown> = {
      deployment_configs: { production: {} as Record<string, unknown> },
    };
    const prod = (restoreBody.deployment_configs as { production: Record<string, unknown> }).production;
    if (Object.keys(savedEnvVars).length > 0) {
      prod.env_vars = savedEnvVars;
    }
    if (Object.keys(savedKv).length > 0) {
      prod.kv_namespaces = savedKv;
    }
    if (Object.keys(savedR2).length > 0) {
      prod.r2_buckets = savedR2;
    }
    if (Object.keys(savedD1).length > 0) {
      prod.d1_databases = savedD1;
    }
    if (Object.keys(prod).length > 0) {
      await fetch(`${CF_API_BASE}/accounts/${accountId}/pages/projects/${projectName}`, {
        method: "PATCH",
        headers: cfHeaders,
        body: JSON.stringify(restoreBody),
      });
    }
  } catch {
    // 恢复失败不影响部署本身
  }
}

export const onRequest: ApiFunction = async ({ request, env, ctx }: ApiContext) => {
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

  // 4. 获取 Pages 项目信息（GitHub 仓库 owner/repo/branch + 环境变量快照）
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

  // 7. 保存部署前的 env_vars + bindings 快照
  const prod = projData.deployment_configs?.production;
  const savedEnvVars = (prod?.env_vars ?? {}) as Record<string, PagesEnvVar>;
  const savedKv = (prod?.kv_namespaces ?? {}) as Record<string, unknown>;
  const savedR2 = (prod?.r2_buckets ?? {}) as Record<string, unknown>;
  const savedD1 = (prod?.d1_databases ?? {}) as Record<string, unknown>;

  try {
    // 8. 用 Contents API 推送/更新 .redeploy-trigger 文件触发 GitHub webhook
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

    // 9. 后台轮询部署状态 + 部署完成后恢复 env_vars/bindings
    const restorePromise = pollAndRestore(
      cfHeaders, accountId, projectName, owner, repo, branch, ghHeaders,
      savedEnvVars, savedKv, savedR2, savedD1,
    );
    if (ctx?.waitUntil) {
      ctx.waitUntil(restorePromise);
    } else {
      void restorePromise;
    }

    return json({
      success: true,
      commit_sha: commitSha,
      message: `已推送 commit 到 ${owner}/${repo}@${branch}，CF Pages 将自动部署，部署完成后自动恢复环境变量。`,
    });
  } catch (e) {
    return json({ success: false, error: `GitHub API 请求失败：${(e as Error).message}` }, 502);
  }
};
