/**
 * CFpanel 共享类型定义
 */

/** Pages Functions 环境变量 */
export interface Environment {
  /** 面板用户列表（JSON 字符串，如 [{"username":"admin","password":"xxx"}]） */
  PANEL_USERS?: string;
  /** 旧版单口令（向后兼容，已弃用，建议迁移到 PANEL_USERS） */
  PANEL_PASSWORD?: string;
  /** Cloudflare API Token（必填，权限按 README 说明创建） */
  CF_API_TOKEN?: string;
}

/** 路由参数：/api/proxy/xxx 中的 xxx 部分 */
export interface ProxyParams {
  proxy?: string | string[];
}

export interface ApiContext {
  request: Request;
  env: Environment;
  params: ProxyParams;
}

export type ApiFunction = (context: ApiContext) => Promise<Response> | Response;