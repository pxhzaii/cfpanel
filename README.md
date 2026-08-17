---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: 'a53e1857-278d-4a27-8173-81805eab5557'
  PropagateID: 'a53e1857-278d-4a27-8173-81805eab5557'
  ReservedCode1: 'd82e4708-6b07-4ea9-8687-2dcf347f56ff'
  ReservedCode2: 'd82e4708-6b07-4ea9-8687-2dcf347f56ff'
---

# CF Panel

手机端 Cloudflare 管理面板，部署在 Cloudflare Pages（含 Pages Functions）。

用浏览器（尤其手机）就能管理：

- **DNS**：域名列表、DNS 记录增删改查、一键切换橙云代理
- **Workers**：脚本列表与代码查看
- **Pages**：项目列表、部署记录
- **存储**：KV 命名空间与键值管理、R2 存储桶列表、D1 数据库执行 SQL

## 安全设计

- 面板有独立**访问口令**（`PANEL_PASSWORD`），每个 API 请求都会校验，口令只存在浏览器 localStorage
- **Cloudflare API Token**（`CF_API_TOKEN`）只存在服务端环境变量，经 `/api/proxy/` 转发调用 Cloudflare API，**绝不下发到浏览器**
- 页面无任何 Token 输入框，Token 泄露面小

## 环境变量

在 Cloudflare Pages 项目 **设置 → 环境变量** 中配置（生产环境建议同时配置到 Production 与 Preview）：

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `PANEL_PASSWORD` | 是 | 访问面板的口令，请用强口令 |
| `CF_API_TOKEN` | 是 | Cloudflare API Token，权限见下表 |

## API Token 权限

在 [API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens) 创建 Token，推荐按需勾选（至少勾选你要用到的功能）：

| 权限组 | 权限 | 范围 |
| --- | --- | --- |
| Zone | Zone → Read | All zones 或指定域名 |
| Zone | DNS → Edit | All zones 或指定域名 |
| Account | Workers Scripts → Read | All accounts |
| Account | Workers KV Storage → Edit | All accounts |
| Account | Workers R2 Storage → Read | All accounts |
| Account | D1 → Edit | All accounts |
| Account | Pages → Read | All accounts |
| Account | Cloudflare Pages → Edit | All accounts |

> 只想要 DNS 的话，最小权限就是 Zone Zone/DNS Edit；要玩 KV 就加 Workers KV Storage Edit；R2 只读、D1 只读/执行按需。

## 本地开发

```bash
npm install
npm run dev        # 前端热更新（Vite，默认 5173）
```

本地联调 Pages Functions：

```bash
# 终端里先设置环境变量（PowerShell 示例）
$env:PANEL_PASSWORD="test123"
$env:CF_API_TOKEN="你的token"

npm run build
npx wrangler pages dev dist
```

打开输出的本地地址即可，登录口令就是 `PANEL_PASSWORD` 的值。

## 部署到 Cloudflare Pages

方式一：**Wrangler CLI**（本机执行）

```bash
npm run build
npx wrangler pages deploy dist --project-name cfpanel
```

方式二：**Git 集成**（推荐，跟其他项目一致）

1. 把本项目推到 GitHub
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → 连接 Git 仓库
3. 构建配置：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
   - Node 版本：20 或以上
4. 在 **设置 → 环境变量** 添加 `PANEL_PASSWORD` 和 `CF_API_TOKEN`
5. 保存后触发首次部署

部署完成后用手机浏览器打开 Pages 域名（如 `cfpanel.pages.dev`），输入口令即可使用。建议顺手在 Cloudflare 控制台把 Pages 项目绑定你的自定义域名（如 `cf.5as.cn`）。

## 技术栈

- Vue 3 + Vite + TypeScript（Vue Router）
- Cloudflare Pages Functions（API 代理）
- 移动端优先布局，底部导航，适配手机浏览器

## 说明

- API Token 泄漏风险由 Token 本身权限决定，建议按最小权限创建
- 面板仅提供浏览器端管理，不做 OAuth 登录（保持简单、无第三方依赖）
- 手机上也可以把面板网址“添加到主屏幕”当作 App 使用

> AI生成