---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '0d8e6694-ac97-44ae-8873-98158f51e097'
  PropagateID: '0d8e6694-ac97-44ae-8873-98158f51e097'
  ReservedCode1: '5d9fc45b-9f67-4df2-ad4b-50772e6cb053'
  ReservedCode2: '5d9fc45b-9f67-4df2-ad4b-50772e6cb053'
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

## 快速部署（3 分钟，零代码）

### 第 1 步：Fork 仓库

点击 [https://github.com/pxhzaii/cfpanel/fork](https://github.com/pxhzaii/cfpanel/fork)，把仓库 Fork 到你自己的 GitHub 账号下。

### 第 2 步：创建 Cloudflare API Token

1. 打开 [API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens)
2. 点 **Create Token**
3. 选 **Create Custom Token** 或使用模板，按下方权限表勾选

### 第 3 步：部署到 Cloudflare Pages

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → Create → Pages
2. 选 **Connect to Git**，授权并选择你 Fork 的 `cfpanel` 仓库
3. 构建配置：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
   - Node 版本：20 或以上
4. 展开高级设置 → 添加环境变量：

   | 变量名 | 值 |
   | --- | --- |
   | `PANEL_PASSWORD` | 你自定义的访问口令（强口令） |
   | `CF_API_TOKEN` | 第 2 步创建的 Token |

5. 保存并部署，等待构建完成（约 1-2 分钟）

### 第 4 步：使用

用手机浏览器打开 Cloudflare 分配的域名（如 `cfpanel-xxx.pages.dev`），输入你设的 `PANEL_PASSWORD` 口令即可使用。

> Account ID 不需要手动设置——登录时面板会自动从 Cloudflare API 获取你的 Account ID 并缓存。

建议在 Pages 项目设置中绑定自定义域名。

---

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
| Account | Cloudflare Pages → Read | All accounts |

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

## 技术栈

- Vue 3 + Vite + TypeScript（Vue Router）
- Cloudflare Pages Functions（API 代理）
- 移动端优先布局，底部导航，适配手机浏览器

## 说明

- API Token 泄漏风险由 Token 本身权限决定，建议按最小权限创建
- 面板仅提供浏览器端管理，不做 OAuth 登录（保持简单、无第三方依赖）
- 手机上也可以把面板网址“添加到主屏幕”当作 App 使用

> AI生成