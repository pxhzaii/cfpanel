<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  auth,
  listApiTokens,
  createApiToken,
  deleteApiToken,
  rotateApiTokenValue,
  listTokenPermissionGroups,
  getUserInfo,
} from "../api/client";
import type {
  CfApiToken,
  CfTokenPermissionGroup,
  CfTokenPolicy,
} from "../api/types";

// ---- 权限名中文映射表 ----
// key = CF API 返回的英文权限名，value = 中文描述
const PERM_CN: Record<string, string> = {
  // --- AI 相关 ---
  "AI Gateway Metadata Read": "AI 网关 元数据读取",
  "AI Gateway Read": "AI 网关 读取",
  "AI Gateway Run": "AI 网关 运行",
  "AI Gateway Write": "AI 网关 写入",
  "AI Search Index Engine": "AI 搜索 索引引擎",
  "AI Search Metadata Read": "AI 搜索 元数据读取",
  "AI Search Read": "AI 搜索 读取",
  "AI Search Run": "AI 搜索 运行",
  "AI Search Write": "AI 搜索 写入",
  "Workers AI Metadata Read": "Workers AI 元数据读取",
  "Workers AI Read": "Workers AI 读取",
  "Workers AI Write": "Workers AI 写入",
  "Auto Rag Read": "Auto RAG 读取",
  "Auto Rag Write": "Auto RAG 写入",
  "Auto Rag Write Run Engine": "Auto RAG 写入运行引擎",
  "Browser Run Read": "浏览器运行 读取",
  "Browser Run Write": "浏览器运行 写入",
  "Firewall for AI Read": "AI 防火墙 读取",
  "Firewall for AI Write": "AI 防火墙 写入",
  "AI Audit Read": "AI 审计 读取",
  "AI Audit Write": "AI 审计 写入",

  // --- Access (Zero Trust) ---
  "Access: Apps Read": "Access 应用 读取",
  "Access: Apps Revoke": "Access 应用 撤销",
  "Access: Apps Write": "Access 应用 写入",
  "Access: Apps and Policies Read": "Access 应用和策略 读取",
  "Access: Apps and Policies Revoke": "Access 应用和策略 撤销",
  "Access: Apps and Policies Write": "Access 应用和策略 写入",
  "Access: Audit Logs Read": "Access 审计日志 读取",
  "Access: Custom Pages Read": "Access 自定义页面 读取",
  "Access: Custom Pages Write": "Access 自定义页面 写入",
  "Access: Device Posture Read": "Access 设备状态 读取",
  "Access: Device Posture Write": "Access 设备状态 写入",
  "Access: Groups Read": "Access 用户组 读取",
  "Access: Groups Write": "Access 用户组 写入",
  "Access: Identity Providers Read": "Access 身份提供者 读取",
  "Access: Identity Providers Write": "Access 身份提供者 写入",
  "Access: Keys Read": "Access 密钥 读取",
  "Access: Keys Write": "Access 密钥 写入",
  "Access: Mutual TLS Certificates Read": "Access 双向 TLS 证书 读取",
  "Access: Mutual TLS Certificates Write": "Access 双向 TLS 证书 写入",
  "Access: Organizations Read": "Access 组织 读取",
  "Access: Organizations Revoke": "Access 组织 撤销",
  "Access: Organizations Write": "Access 组织 写入",
  "Access: Organizations, Identity Providers, and Groups Read": "Access 组织/身份提供者/用户组 读取",
  "Access: Organizations, Identity Providers, and Groups Revoke": "Access 组织/身份提供者/用户组 撤销",
  "Access: Organizations, Identity Providers, and Groups Write": "Access 组织/身份提供者/用户组 写入",
  "Access: Policies Read": "Access 策略 读取",
  "Access: Policies Write": "Access 策略 写入",
  "Access: Policy Test Read": "Access 策略测试 读取",
  "Access: Policy Test Write": "Access 策略测试 写入",
  "Access: Population Read": "Access 人群 读取",
  "Access: Population Write": "Access 人群 写入",
  "Access: SAML Certificates Read": "Access SAML 证书 读取",
  "Access: SAML Certificates Write": "Access SAML 证书 写入",
  "Access: SCIM Logs Read": "Access SCIM 日志 读取",
  "Access: SSH Auditing Read": "Access SSH 审计 读取",
  "Access: SSH Auditing Write": "Access SSH 审计 写入",
  "Access: Service Tokens Read": "Access 服务令牌 读取",
  "Access: Service Tokens Write": "Access 服务令牌 写入",
  "Access: Tags Read": "Access 标签 读取",
  "Access: Tags Write": "Access 标签 写入",
  "Access: Users Read": "Access 用户 读取",
  "Access: Users Write": "Access 用户 写入",

  // --- 账户级设置 ---
  "Account API Gateway": "账户 API 网关",
  "Account API Gateway Read": "账户 API 网关 读取",
  "Account API Tokens Read": "账户 API 令牌 读取",
  "Account API Tokens Write": "账户 API 令牌 写入",
  "Account Abuse Protection PII Read": "账户滥用保护 PII 读取",
  "Account Analytics Read": "账户分析 读取",
  "Account Custom Asset Read": "账户自定义资产 读取",
  "Account Custom Asset Write": "账户自定义资产 写入",
  "Account Custom Error Rules Read": "账户自定义错误规则 读取",
  "Account Custom Error Rules Write": "账户自定义错误规则 写入",
  "Account Custom Pages Read": "账户自定义页面 读取",
  "Account Custom Pages Write": "账户自定义页面 写入",
  "Account DNS Settings Read": "账户 DNS 设置 读取",
  "Account DNS Settings Write": "账户 DNS 设置 写入",
  "Account Firewall Access Rules Read": "账户防火墙访问规则 读取",
  "Account Firewall Access Rules Write": "账户防火墙访问规则 写入",
  "Account Rule Lists Read": "账户规则列表 读取",
  "Account Rule Lists Write": "账户规则列表 写入",
  "Account Rulesets Read": "账户规则集 读取",
  "Account Rulesets Write": "账户规则集 写入",
  "Account Security Center Insights Read": "账户安全中心洞察 读取",
  "Account Security Center Insights Write": "账户安全中心洞察 写入",
  "Account Settings Read": "账户设置 读取",
  "Account Settings Write": "账户设置 写入",
  "Account WAF Read": "账户 WAF 读取",
  "Account WAF Write": "账户 WAF 写入",
  "Account Waiting Rooms Read": "账户等候室 读取",
  "Account: SSL and Certificates Read": "账户 SSL 和证书 读取",
  "Account: SSL and Certificates Write": "账户 SSL 和证书 写入",

  // --- 地址映射 / 代理 ---
  "Address Maps Read": "地址映射 读取",
  "Address Maps Write": "地址映射 写入",

  // --- 代理 / Agent ---
  "Agent Memory Write": "Agent 记忆 写入",
  "Agents Gateway Read": "Agent 网关 读取",
  "Agents Gateway Run": "Agent 网关 运行",
  "Agents Gateway Write": "Agent 网关 写入",
  "CF Agents Read": "CF Agent 读取",
  "CF Agents Write": "CF Agent 写入",

  // --- 其他账户级服务 ---
  "Allow Request Tracer Read": "请求追踪器 读取",
  "Application Security Reports Read": "应用安全报告 读取",
  "Artifacts Read": "制品 读取",
  "Artifacts Write": "制品 写入",
  "Billing Read": "账单 读取",
  "Billing Write": "账单 写入",
  "CASB Read": "CASB 读取",
  "CASB Write": "CASB 写入",
  "Calls Read": "Calls 读取",
  "Calls Write": "Calls 写入",
  "China Network Steering Read": "中国网络引导 读取",
  "China Network Steering Write": "中国网络引导 写入",
  "Cloud Email Security: Read": "云邮件安全 读取",
  "Cloud Email Security: Write": "云邮件安全 写入",
  "Cloudchamber Read": "Cloudchamber 读取",
  "Cloudchamber Write": "Cloudchamber 写入",
  "Cloudflare CDS Compute Account Read": "CF CDS 计算 读取",
  "Cloudflare CDS Compute Account Write": "CF CDS 计算 写入",
  "Cloudflare DEX": "CF DEX",
  "Cloudflare DEX Read": "CF DEX 读取",
  "Cloudflare DEX Write": "CF DEX 写入",
  "Cloudflare One Connector Monitoring: cloudflared": "CF One 连接器监控 cloudflared",
  "Cloudflare One Connector: WARP Read": "CF One 连接器 WARP 读取",
  "Cloudflare One Connector: WARP Write": "CF One 连接器 WARP 写入",
  "Cloudflare One Connector: cloudflared Read": "CF One 连接器 cloudflared 读取",
  "Cloudflare One Connector: cloudflared Write": "CF One 连接器 cloudflared 写入",
  "Cloudflare One Connectors Read": "CF One 连接器 读取",
  "Cloudflare One Connectors Write": "CF One 连接器 写入",
  "Cloudflare One Networks Read": "CF One 网络 读取",
  "Cloudflare One Networks Write": "CF One 网络 写入",
  "Cloudflare Tunnel Read": "CF 隧道 读取",
  "Cloudflare Tunnel Write": "CF 隧道 写入",
  "Cloudflare Zero Trust Secure DNS Locations Write": "CF Zero Trust 安全 DNS 位置 写入",
  "Cloudforce One Read": "Cloudforce One 读取",
  "Cloudforce One Write": "Cloudforce One 写入",
  "Connectivity Directory Admin": "连接目录 管理",
  "Connectivity Directory Bind": "连接目录 绑定",
  "Connectivity Directory Read": "连接目录 读取",
  "Constellation Read": "Constellation 读取",
  "Constellation Write": "Constellation 写入",

  // --- D1 数据库 ---
  "D1 Metadata Read": "D1 元数据读取",
  "D1 Read": "D1 读取",
  "D1 Write": "D1 写入",

  // --- DDoS 防护 ---
  "DDoS Botnet Feed Read": "DDoS 僵尸网络源 读取",
  "DDoS Botnet Feed Write": "DDoS 僵尸网络源 写入",
  "DDoS Protection Read": "DDoS 防护 读取",
  "DDoS Protection Write": "DDoS 防护 写入",
  "L4 DDoS Managed Ruleset Read": "L4 DDoS 托管规则集 读取",
  "L4 DDoS Managed Ruleset Write": "L4 DDoS 托管规则集 写入",
  "HTTP DDoS Managed Ruleset Read": "HTTP DDoS 托管规则集 读取",
  "HTTP DDoS Managed Ruleset Write": "HTTP DDoS 托管规则集 写入",

  // --- DLS ---
  "DLS: Read": "DLS 读取",
  "DLS: Write": "DLS 写入",

  // --- DNS ---
  "DNS Firewall Read": "DNS 防火墙 读取",
  "DNS Firewall Write": "DNS 防火墙 写入",
  "DNS View Read": "DNS 视图 读取",
  "DNS View Write": "DNS 视图 写入",
  "DNS Read": "DNS 读取",
  "DNS Write": "DNS 写入",
  "Zone DNS Settings Read": "区域 DNS 设置 读取",
  "Zone DNS Settings Write": "区域 DNS 设置 写入",

  // --- Disable ESC ---
  "Disable ESC Read": "禁用 ESC 读取",
  "Disable ESC Write": "禁用 ESC 写入",

  // --- 邮件路由 ---
  "Email Routing Account Rules Read": "邮件路由账户规则 读取",
  "Email Routing Addresses Read": "邮件路由地址 读取",
  "Email Routing Addresses Write": "邮件路由地址 写入",
  "Email Routing Suppressions Read": "邮件路由屏蔽 读取",
  "Email Routing Suppressions Write": "邮件路由屏蔽 写入",
  "Email Routing Rules Read": "邮件路由规则 读取",
  "Email Routing Rules Write": "邮件路由规则 写入",
  "Email Security DMARC Reports Read": "邮件安全 DMARC 报告 读取",
  "Email Security DMARC Reports Write": "邮件安全 DMARC 报告 写入",
  "Email Sending Read": "邮件发送 读取",
  "Email Sending Write": "邮件发送 写入",

  // --- 字段提取 / 欺诈 ---
  "Field Extractors Read": "字段提取器 读取",
  "Field Extractors Write": "字段提取器 写入",
  "Fraud Events Write": "欺诈事件 写入",
  "Fraud Feedback Read": "欺诈反馈 读取",
  "Fraud Feedback Write": "欺诈反馈 写入",
  "Fraud Detection Read": "欺诈检测 读取",
  "Fraud Detection Write": "欺诈检测 写入",

  // --- Flagship ---
  "Flagship Evaluate": "Flagship 评估",
  "Flagship Read": "Flagship 读取",
  "Flagship Write": "Flagship 写入",
  "Flagship App Bind": "Flagship 应用 绑定",
  "Flagship App Evaluate": "Flagship 应用 评估",
  "Flagship App Read": "Flagship 应用 读取",
  "Flagship App Write": "Flagship 应用 写入",

  // --- HTTP 应用 ---
  "HTTP Applications Read": "HTTP 应用 读取",
  "HTTP Applications Write": "HTTP 应用 写入",

  // --- Hyperdrive ---
  "Hyperdrive Read": "Hyperdrive 读取",
  "Hyperdrive Write": "Hyperdrive 写入",

  // --- IOT ---
  "IOT Read": "IoT 读取",
  "IOT Write": "IoT 写入",

  // --- IP 前缀 ---
  "IP Prefixes: BGP On Demand Read": "IP 前缀 BGP 按需 读取",
  "IP Prefixes: BGP On Demand Write": "IP 前缀 BGP 按需 写入",
  "IP Prefixes: Read": "IP 前缀 读取",
  "IP Prefixes: Write": "IP 前缀 写入",

  // --- 图片 ---
  "Images Metadata Read": "图片 元数据读取",
  "Images Read": "图片 读取",
  "Images Write": "图片 写入",

  // --- 集成 ---
  "Integration Write": "集成 写入",

  // --- Intel ---
  "Intel Read": "Intel 读取",
  "Intel Write": "Intel 写入",

  // --- 负载均衡 ---
  "Load Balancers Account Read": "负载均衡账户 读取",
  "Load Balancers Account Write": "负载均衡账户 写入",
  "Load Balancers Read": "负载均衡 读取",
  "Load Balancers Write": "负载均衡 写入",
  "Load Balancing: Monitors and Pools Read": "负载均衡监控器和池 读取",
  "Load Balancing: Monitors and Pools Write": "负载均衡监控器和池 写入",

  // --- 日志 ---
  "Logs Read": "日志 读取",
  "Logs Write": "日志 写入",

  // --- MCP / Messaging ---
  "MCP Portals Read": "MCP 门户 读取",
  "MCP Portals Write": "MCP 门户 写入",
  "Messaging Edit": "消息 编辑",
  "Messaging Metadata Read": "消息 元数据读取",
  "Messaging Read": "消息 读取",

  // --- Magic ---
  "Magic Firewall Packet Captures - Read PCAPs API": "Magic 防火墙抓包 读取",
  "Magic Firewall Packet Captures - Write PCAPs API": "Magic 防火墙抓包 写入",
  "Magic Firewall Read": "Magic 防火墙 读取",
  "Magic Firewall Write": "Magic 防火墙 写入",
  "Magic Network Monitoring Admin": "Magic 网络监控 管理",
  "Magic Network Monitoring Config Read": "Magic 网络监控配置 读取",
  "Magic Network Monitoring Config Write": "Magic 网络监控配置 写入",
  "Magic Transit Read": "Magic Transit 读取",
  "Magic Transit Write": "Magic Transit 写入",
  "Magic WAN Read": "Magic WAN 读取",
  "Magic WAN Write": "Magic WAN 写入",

  // --- 大规模 URL 重定向 ---
  "Mass URL Redirects Read": "批量 URL 重定向 读取",
  "Mass URL Redirects Write": "批量 URL 重定向 写入",

  // --- MoQ ---
  "MoQ Read": "MoQ 读取",
  "MoQ Write": "MoQ 写入",

  // --- 通知 ---
  "Notifications Read": "通知 读取",
  "Notifications Write": "通知 写入",

  // --- OAuth ---
  "OAuth Client Read": "OAuth 客户端 读取",
  "OAuth Client Write": "OAuth 客户端 写入",

  // --- Page Shield ---
  "Page Shield": "页面护盾",
  "Page Shield Read": "页面护盾 读取",
  "Page Shield Write": "页面护盾 写入",
  "Domain Page Shield": "域名页面护盾",
  "Domain Page Shield Read": "域名页面护盾 读取",

  // --- Pages ---
  "Pages Metadata Read": "Pages 元数据读取",
  "Pages Read": "Pages 读取",
  "Pages Write": "Pages 写入",

  // --- Pipelines ---
  "Pipelines Read": "流水线 读取",
  "Pipelines Send": "流水线 发送",
  "Pipelines Write": "流水线 写入",

  // --- Pubsub ---
  "Pubsub Configuration Read": "Pubsub 配置 读取",
  "Pubsub Configuration Write": "Pubsub 配置 写入",

  // --- Queues ---
  "Queues Metadata Read": "队列 元数据读取",
  "Queues Read": "队列 读取",
  "Queues Write": "队列 写入",

  // --- Radar ---
  "Radar Read": "Radar 读取",

  // --- Realtime ---
  "Realtime": "实时",
  "Realtime Admin": "实时 管理",
  "Realtime Read": "实时 读取",

  // --- 注册商域名 ---
  "Registrar Domains Admin": "注册商域名 管理",
  "Registrar Domains Read": "注册商域名 读取",
  "Registrar Sandbox Domains Admin": "注册商沙盒域名 管理",
  "Registrar Sandbox Domains Read": "注册商沙盒域名 读取",

  // --- 资源库 / 共享 ---
  "Resource Library Read": "资源库 读取",
  "Resource Library Write": "资源库 写入",
  "Resource Sharing Read": "资源共享 读取",

  // --- 规则策略 ---
  "Rule Policies Read": "规则策略 读取",
  "Rule Policies Write": "规则策略 写入",

  // --- SCIM / SSO ---
  "SCIM Provisioning": "SCIM 预配",
  "SSO Connector Read": "SSO 连接器 读取",
  "SSO Connector Write": "SSO 连接器 写入",

  // --- 密钥存储 ---
  "Secrets Store Read": "密钥存储 读取",
  "Secrets Store Write": "密钥存储 写入",

  // --- Select 配置 ---
  "Select Configuration Read": "Select 配置 读取",
  "Select Configuration Write": "Select 配置 写入",

  // --- Stream ---
  "Stream Metadata Read": "Stream 元数据读取",
  "Stream Read": "Stream 读取",
  "Stream Write": "Stream 写入",

  // --- 标签 ---
  "Tag Read": "标签 读取",
  "Tag Write": "标签 写入",

  // --- 转换规则 ---
  "Transform Rules Read": "转换规则 读取",
  "Transform Rules Write": "转换规则 写入",
  "Zone Transform Rules Read": "区域转换规则 读取",
  "Zone Transform Rules Write": "区域转换规则 写入",

  // --- Trust and Safety ---
  "Trust and Safety Read": "信任与安全 读取",
  "Trust and Safety Write": "信任与安全 写入",

  // --- Turnstile ---
  "Turnstile Sites Read": "Turnstile 站点 读取",
  "Turnstile Sites Write": "Turnstile 站点 写入",

  // --- URL 扫描 ---
  "URL Scanner Read": "URL 扫描器 读取",
  "URL Scanner Write": "URL 扫描器 写入",

  // --- Vectorize ---
  "Vectorize Read": "Vectorize 读取",
  "Vectorize Write": "Vectorize 写入",

  // --- Websearch ---
  "Websearch Metadata Read": "Web 搜索 元数据读取",
  "Websearch Read": "Web 搜索 读取",
  "Websearch Run": "Web 搜索 运行",
  "Websearch Write": "Web 搜索 写入",

  // --- Workers 相关 ---
  "Workers CI Read": "Workers CI 读取",
  "Workers CI Write": "Workers CI 写入",
  "Workers Containers Read": "Workers 容器 读取",
  "Workers Containers Write": "Workers 容器 写入",
  "Workers KV Storage Metadata Read": "Workers KV 存储 元数据读取",
  "Workers KV Storage Read": "Workers KV 存储 读取",
  "Workers KV Storage Write": "Workers KV 存储 写入",
  "Workers Observability Read": "Workers 可观测性 读取",
  "Workers Observability Telemetry Write": "Workers 可观测性遥测 写入",
  "Workers Observability Write": "Workers 可观测性 写入",
  "Workers R2 Data Catalog Read": "Workers R2 数据目录 读取",
  "Workers R2 Data Catalog Write": "Workers R2 数据目录 写入",
  "Workers R2 SQL Read": "Workers R2 SQL 读取",
  "Workers R2 Storage Metadata Read": "Workers R2 存储 元数据读取",
  "Workers R2 Storage Read": "Workers R2 存储 读取",
  "Workers R2 Storage Write": "Workers R2 存储 写入",
  "Workers R2 Storage Bucket Item Read": "Workers R2 存储桶对象 读取",
  "Workers R2 Storage Bucket Item Write": "Workers R2 存储桶对象 写入",
  "Workers Scripts Read": "Workers 脚本 读取",
  "Workers Scripts Write": "Workers 脚本 写入",
  "Workers Tail Read": "Workers Tail 读取",
  "Workers Routes Read": "Workers 路由 读取",
  "Workers Routes Write": "Workers 路由 写入",

  // --- Zero Trust ---
  "Zero Trust Read": "Zero Trust 读取",
  "Zero Trust Report": "Zero Trust 报告",
  "Zero Trust Resilience Read": "Zero Trust 弹性 读取",
  "Zero Trust Resilience Write": "Zero Trust 弹性 写入",
  "Zero Trust Write": "Zero Trust 写入",
  "Zero Trust: PII Read": "Zero Trust PII 读取",
  "Zero Trust: Seats Write": "Zero Trust 席位 写入",

  // --- Zone 级别 ---
  "Zone Custom Asset Read": "区域自定义资产 读取",
  "Zone Custom Asset Write": "区域自定义资产 写入",
  "Zone Read": "区域 读取",
  "Zone Security Center Insights Read": "区域安全中心洞察 读取",
  "Zone Security Center Insights Write": "区域安全中心洞察 写入",
  "Zone Settings Read": "区域设置 读取",
  "Zone Settings Write": "区域设置 写入",
  "Zone Versioning Read": "区域版本控制 读取",
  "Zone Versioning Write": "区域版本控制 写入",
  "Zone WAF Read": "区域 WAF 读取",
  "Zone WAF Write": "区域 WAF 写入",
  "Zone Write": "区域 写入",
  "Domain API Gateway": "域名 API 网关",
  "Domain API Gateway Read": "域名 API 网关 读取",
  "Apps Write": "应用 写入",

  // --- 分析 ---
  "Analytics Read": "分析 读取",

  // --- 机器人管理 ---
  "Bot Management Feedback Report Read": "机器人管理反馈报告 读取",
  "Bot Management Feedback Report Write": "机器人管理反馈报告 写入",
  "Bot Management Read": "机器人管理 读取",
  "Bot Management Write": "机器人管理 写入",

  // --- 缓存 ---
  "Cache Purge": "缓存清除",
  "Cache Settings Read": "缓存设置 读取",
  "Cache Settings Write": "缓存设置 写入",

  // --- Cloud Connector ---
  "Cloud Connector Read": "云连接器 读取",
  "Cloud Connector Write": "云连接器 写入",

  // --- 配置 ---
  "Config Settings Read": "配置设置 读取",
  "Config Settings Write": "配置设置 写入",

  // --- 自定义错误/页面 ---
  "Custom Errors Read": "自定义错误 读取",
  "Custom Errors Write": "自定义错误 写入",
  "Custom Pages Read": "自定义页面 读取",
  "Custom Pages Write": "自定义页面 写入",

  // --- 动态 URL 重定向 ---
  "Dynamic URL Redirects Read": "动态 URL 重定向 读取",
  "Dynamic URL Redirects Write": "动态 URL 重定向 写入",

  // --- 防火墙服务 ---
  "Firewall Services Read": "防火墙服务 读取",
  "Firewall Services Write": "防火墙服务 写入",

  // --- 健康检查 ---
  "Health Checks Read": "健康检查 读取",
  "Health Checks Write": "健康检查 写入",

  // --- 托管 headers ---
  "Managed headers Read": "托管头 读取",
  "Managed headers Write": "托管头 写入",

  // --- 源站 ---
  "Origin Read": "源站 读取",
  "Origin Write": "源站 写入",

  // --- 页面规则 ---
  "Page Rules Read": "页面规则 读取",
  "Page Rules Write": "页面规则 写入",

  // --- Precursor ---
  "Precursor Read": "Precursor 读取",
  "Precursor Write": "Precursor 写入",

  // --- 响应压缩 ---
  "Response Compression Read": "响应压缩 读取",
  "Response Compression Write": "响应压缩 写入",

  // --- SSL 和证书 ---
  "SSL and Certificates Read": "SSL 和证书 读取",
  "SSL and Certificates Write": "SSL 和证书 写入",

  // --- Sanitize ---
  "Sanitize Read": "数据清洗 读取",
  "Sanitize Write": "数据清洗 写入",

  // --- Snippets ---
  "Snippets Read": "代码片段 读取",
  "Snippets Write": "代码片段 写入",

  // --- 等候室 ---
  "Waiting Rooms Read": "等候室 读取",
  "Waiting Rooms Write": "等候室 写入",

  // --- Web3 主机名 ---
  "Web3 Hostnames Read": "Web3 主机名 读取",
  "Web3 Hostnames Write": "Web3 主机名 写入",

  // --- Zaraz ---
  "Zaraz Admin": "Zaraz 管理",
  "Zaraz Edit": "Zaraz 编辑",
  "Zaraz Read": "Zaraz 读取",

  // --- User 级别 ---
  "API Tokens Read": "API 令牌 读取",
  "API Tokens Write": "API 令牌 写入",
  "Memberships Read": "成员资格 读取",
  "Memberships Write": "成员资格 写入",
  "User Details Read": "用户详情 读取",
  "User Details Write": "用户详情 写入",
};

/** 获取权限的中文描述，没有映射时原样返回 */
function permNameCN(name: string): string {
  return PERM_CN[name] ?? name;
}

const tokens = ref<CfApiToken[]>([]);
const permissionGroups = ref<CfTokenPermissionGroup[]>([]);
const loading = ref(false);
const error = ref("");

// 创建 Token 弹窗
const showCreate = ref(false);
const newName = ref("");
const selectedPermIds = ref<string[]>([]);
const expiresInDays = ref<number>(0); // 0 = 永不过期
const creating = ref(false);
const createdTokenValue = ref<string | null>(null);
// 复制状态：创建和轮换各自独立，避免快速切换时状态错乱
const copiedCreate = ref(false);
const copiedRotate = ref(false);

async function copyText(text: string, which: "create" | "rotate" = "create") {
  const flag = which === "create" ? copiedCreate : copiedRotate;
  try {
    await navigator.clipboard.writeText(text);
    flag.value = true;
    setTimeout(() => { flag.value = false; }, 2000);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    flag.value = true;
    setTimeout(() => { flag.value = false; }, 2000);
  }
}

// 权限过滤分类
type PermFilter = "" | "dns" | "workers" | "database" | "custom";
const permFilter = ref<PermFilter>("");

  // 各分类的关键词匹配规则（同时匹配英文原名和中文翻译）
const FILTER_KEYWORDS: Record<Exclude<PermFilter, "">, string[]> = {
  dns: ["dns", "域名"],
  workers: ["worker", "pages", "script", "kv", "r2", "storage", "脚本", "存储", "队列"],
  database: ["d1", "database", "sql", "数据库"],
  custom: [], // 全部
};

function setPermFilter(f: PermFilter) {
  if (permFilter.value === f) {
    // 再次点击同一个则取消
    permFilter.value = "";
  } else {
    permFilter.value = f;
  }
}

function matchesFilter(pg: CfTokenPermissionGroup, f: PermFilter): boolean {
  if (!f || f === "custom") return true;
  // 同时匹配英文原名和中文翻译
  const nameEN = pg.name.toLowerCase();
  const nameCN = permNameCN(pg.name).toLowerCase();
  const keywords = FILTER_KEYWORDS[f] ?? [];
  return keywords.some((kw) => nameEN.includes(kw) || nameCN.includes(kw));
}

// 删除确认
const confirmDeleteId = ref<string | null>(null);

// 轮换确认
const confirmRotateId = ref<string | null>(null);
const rotatedValue = ref<string | null>(null);

/** scope 中文名称映射 */
const SCOPE_CN: Record<string, string> = {
  "com.cloudflare.api.account": "账户级权限",
  "com.cloudflare.api.account.zone": "区域级权限",
  "com.cloudflare.api.user": "用户级权限",
  "com.cloudflare.api.account.flagship.app": "Flagship 应用权限",
  "com.cloudflare.edge.r2.bucket": "R2 存储桶权限",
};

/** 获取 scope 的中文标签 */
function scopeLabel(scope: string): string {
  return SCOPE_CN[scope] ?? scope;
}

// ---- 权限解析与分组 ----

/** 已知操作后缀（按优先级排序，长的先匹配） */
const KNOWN_OPS = [
  "Metadata Read", "Metadata Write",
  "Run Engine", "Send",
  "Telemetry Write",
  "Read", "Write", "Run", "Edit", "Revoke", "Admin", "Bind", "Purge",
  "Report", "Action", "Preview", "Trace", "Raw",
];

/** 操作后缀→中文翻译 */
const OP_CN: Record<string, string> = {
  "Metadata Read": "元数据读取",
  "Metadata Write": "元数据写入",
  "Run Engine": "运行引擎",
  "Send": "发送",
  "Read": "读取",
  "Write": "写入",
  "Run": "运行",
  "Edit": "编辑",
  "Revoke": "撤销",
  "Admin": "管理",
  "Bind": "绑定",
  "Purge": "清除",
  "Report": "报告",
  "Telemetry Write": "遥测写入",
  "Action": "操作",
  "Preview": "预览",
  "Trace": "追踪",
  "Raw": "原始",
};

interface ParsedPerm {
  pg: CfTokenPermissionGroup;
  service: string;   // 英文服务名
  op: string;         // 英文操作名
  level: "read" | "write" | "other";
}

function parsePerm(pg: CfTokenPermissionGroup): ParsedPerm {
  const name = pg.name;
  let op = "";
  let service = name;
  for (const suffix of KNOWN_OPS) {
    if (name.toLowerCase().endsWith(suffix.toLowerCase())) {
      op = suffix;
      service = name.slice(0, name.length - suffix.length).trim().replace(/[:\s]+$/, "");
      break;
    }
  }
  return {
    pg,
    service: service || name,
    op,
    level: permLevel(pg),
  };
}

/** 获取服务的中文显示名 */
function serviceCN(service: string): string {
  // 从映射表中找完整权限名，取去掉操作后缀后的部分作为中文服务名
  // 用精确匹配的方式不可行（因为映射是全名→全名），改用启发式：
  // 先找完整权限名映射，去掉操作后缀部分
  const enName = service;
  // 尝试从映射表中反向推导：如果某个权限名以该 service 开头，取映射结果的对应部分
  for (const [enPerm, cnPerm] of Object.entries(PERM_CN)) {
    if (enPerm.startsWith(enName)) {
      // 取中文翻译中去掉操作部分的前缀
      const opSuffix = enPerm.slice(enName.length).trim();
      const cnOp = OP_CN[opSuffix] ?? opSuffix;
      if (cnPerm.endsWith(cnOp)) {
        return cnPerm.slice(0, cnPerm.length - cnOp.length).trim();
      }
    }
  }
  return enName;
}

/** 获取操作后缀的中文显示名 */
function opCN(op: string): string {
  return OP_CN[op] ?? op;
}

interface ServiceGroup {
  service: string;
  scope: string;
  perms: ParsedPerm[];
  hasWrite: boolean;
  hasRead: boolean;
  opCount: number;
  readOnly: boolean;   // 只有 Read，没有 Write
  multiOp: boolean;   // 3+ 个操作
}

/** 按服务分组，支持分类过滤 */
const serviceGroups = computed<ServiceGroup[]>(() => {
  const filter = permFilter.value;
  const parsed = permissionGroups.value
    .filter((pg) => matchesFilter(pg, filter))
    .map(parsePerm);

  const map = new Map<string, ServiceGroup>();
  for (const p of parsed) {
    const scope = p.pg.scopes?.[0] ?? "其他";
    const key = `${scope}::${p.service}`;
    if (!map.has(key)) {
      map.set(key, {
        service: p.service,
        scope,
        perms: [],
        hasWrite: false,
        hasRead: false,
        opCount: 0,
        readOnly: false,
        multiOp: false,
      });
    }
    const g = map.get(key)!;
    g.perms.push(p);
    if (p.level === "write") g.hasWrite = true;
    if (p.level === "read") g.hasRead = true;
  }

  const groups = [...map.values()];
  for (const g of groups) {
    // 去重操作名
    const ops = new Set(g.perms.map((p) => p.op));
    g.opCount = ops.size;
    g.readOnly = g.hasRead && !g.hasWrite;
    g.multiOp = g.opCount >= 3;
  }

  // 排序：有写的优先，仅读的排后面，按名称字母序
  groups.sort((a, b) => {
    if (a.readOnly !== b.readOnly) return a.readOnly ? 1 : -1;
    return a.service.localeCompare(b.service);
  });

  return groups;
});

/** 按 scope 再分组 service groups */
const scopedServiceGroups = computed(() => {
  const map = new Map<string, ServiceGroup[]>();
  for (const g of serviceGroups.value) {
    if (!map.has(g.scope)) map.set(g.scope, []);
    map.get(g.scope)!.push(g);
  }
  return map;
});

// ---- 选择操作 ----

function togglePerm(id: string) {
  const idx = selectedPermIds.value.indexOf(id);
  if (idx >= 0) {
    selectedPermIds.value.splice(idx, 1);
  } else {
    selectedPermIds.value.push(id);
  }
}

function isPermSelected(id: string): boolean {
  return selectedPermIds.value.includes(id);
}

/** 全选当前搜索结果 */
function selectAllFiltered() {
  const current = new Set(selectedPermIds.value);
  for (const g of serviceGroups.value) {
    for (const p of g.perms) {
      current.add(p.pg.id);
    }
  }
  selectedPermIds.value = [...current];
}

function selectFilteredRead() {
  const current = new Set(selectedPermIds.value);
  for (const g of serviceGroups.value) {
    for (const p of g.perms) {
      if (p.level === "read") current.add(p.pg.id);
    }
  }
  selectedPermIds.value = [...current];
}

function selectFilteredWrite() {
  const current = new Set(selectedPermIds.value);
  for (const g of serviceGroups.value) {
    for (const p of g.perms) {
      if (p.level === "write") current.add(p.pg.id);
    }
  }
  selectedPermIds.value = [...current];
}

function selectService(g: ServiceGroup) {
  const current = new Set(selectedPermIds.value);
  for (const p of g.perms) {
    current.add(p.pg.id);
  }
  selectedPermIds.value = [...current];
}

function selectServiceByLevel(g: ServiceGroup, level: "read" | "write") {
  const current = new Set(selectedPermIds.value);
  for (const p of g.perms) {
    if (p.level === level) current.add(p.pg.id);
  }
  selectedPermIds.value = [...current];
}

function clearSelection() {
  selectedPermIds.value = [];
  permFilter.value = "";
}

// ---- 数据加载 ----

async function loadTokens() {
  loading.value = true;
  error.value = "";
  try {
    tokens.value = await listApiTokens();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadPermissionGroups() {
  try {
    permissionGroups.value = await listTokenPermissionGroups();
  } catch (e) {
    console.error("加载权限组失败", e);
  }
}

// 缓存 user id（CF 的真实用户 id，非 account id）
const cfUserId = ref<string>("");

async function ensureUserId(): Promise<string> {
  if (cfUserId.value) return cfUserId.value;
  const user = await getUserInfo();
  cfUserId.value = user.id;
  return cfUserId.value;
}

async function handleCreate() {
  if (!newName.value.trim()) {
    error.value = "请填写 Token 名称";
    return;
  }
  if (selectedPermIds.value.length === 0) {
    error.value = "请至少选择一个权限组";
    return;
  }
  creating.value = true;
  error.value = "";
  try {
    // 根据选中权限组的 scopes 构建 resources
    // account/zone scope -> "com.cloudflare.api.account.<accountId>": "*"
    // user scope -> "com.cloudflare.api.user.<userId>": "*"
    const accountId = auth.accountId;
    const userId = await ensureUserId();

    // 收集选中的权限组
    const selectedGroups = permissionGroups.value.filter((g) =>
      selectedPermIds.value.includes(g.id),
    );

    // 按 resource scope 分组：account 类和 user 类
    const accountPermIds: string[] = [];
    const userPermIds: string[] = [];
    for (const g of selectedGroups) {
      const scopes = g.scopes || [];
      const isUserScope = scopes.some((s) => s.startsWith("com.cloudflare.api.user"));
      if (isUserScope) {
        userPermIds.push(g.id);
      } else {
        // account / account.zone / edge.r2 等都归入 account resource
        accountPermIds.push(g.id);
      }
    }

    // 构建 policies：每组相同 resource scope 的权限放一个 policy
    const policies: CfTokenPolicy[] = [];
    if (accountPermIds.length > 0) {
      policies.push({
        effect: "allow",
        resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        permission_groups: accountPermIds.map((id) => ({ id })),
      });
    }
    if (userPermIds.length > 0) {
      policies.push({
        effect: "allow",
        resources: { [`com.cloudflare.api.user.${userId}`]: "*" },
        permission_groups: userPermIds.map((id) => ({ id })),
      });
    }

    let expires_on: string | null = null;
    if (expiresInDays.value > 0) {
      const d = new Date();
      d.setDate(d.getDate() + expiresInDays.value);
      expires_on = d.toISOString();
    }
    const result = await createApiToken({
      name: newName.value.trim(),
      policies,
      expires_on,
    });
    createdTokenValue.value = result.value ?? null;
    await loadTokens();
    newName.value = "";
    selectedPermIds.value = [];
    expiresInDays.value = 0;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    creating.value = false;
  }
}

async function handleDelete(tokenId: string) {
  try {
    await deleteApiToken(tokenId);
    confirmDeleteId.value = null;
    await loadTokens();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function handleRotate(tokenId: string) {
  try {
    const result = await rotateApiTokenValue(tokenId);
    rotatedValue.value = result.value;
    confirmRotateId.value = null;
    await loadTokens();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function closeCreateModal() {
  showCreate.value = false;
  createdTokenValue.value = null;
  newName.value = "";
  selectedPermIds.value = [];
  expiresInDays.value = 0;
  permFilter.value = "";
  error.value = "";
  copiedCreate.value = false;
}

function formatDate(s?: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}

function permLevel(pg: CfTokenPermissionGroup): "read" | "write" | "other" {
  const name = pg.name.toLowerCase();
  if (name.includes("write") || name.includes("edit")) return "write";
  if (name.includes("read")) return "read";
  return "other";
}

function permLevelLabel(level: "read" | "write" | "other"): string {
  switch (level) {
    case "read": return "只读";
    case "write": return "读写";
    default: return "其他";
  }
}

function permLevelColor(level: "read" | "write" | "other"): string {
  switch (level) {
    case "read": return "#7aa2f7";
    case "write": return "#e0af68";
    default: return "#8b95a9";
  }
}

/** Token 权限信息缓存（避免模板中重复计算） */
interface TokenPermInfo {
  name: string;
  level: "read" | "write" | "other";
}
const tokenPermsCache = computed<Map<string, TokenPermInfo[]>>(() => {
  const map = new Map<string, TokenPermInfo[]>();
  for (const token of tokens.value) {
    const result: TokenPermInfo[] = [];
    const seen = new Set<string>();
    for (const policy of token.policies ?? []) {
      for (const pg of policy.permission_groups ?? []) {
        if (seen.has(pg.id)) continue;
        seen.add(pg.id);
        const found = permissionGroups.value.find((p) => p.id === pg.id);
        if (found) {
          result.push({ name: permNameCN(found.name), level: permLevel(found) });
        }
      }
    }
    map.set(token.id, result);
  }
  return map;
});

function statusColor(status: string): string {
  switch (status) {
    case "active": return "#73daca";
    case "expired": return "#ff7a6e";
    case "expiring": return "#e0af68";
    default: return "#8b95a9";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "active": return "活跃";
    case "expired": return "已过期";
    case "expiring": return "即将过期";
    case "deleted": return "已删除";
    default: return status;
  }
}

onMounted(() => {
  loadTokens();
  loadPermissionGroups();
});
</script>

<template>
  <div class="tokens">
    <div class="header">
      <h2>API 令牌</h2>
      <button class="btn-add" @click="showCreate = true">+ 新建令牌</button>
    </div>

    <p v-if="error" class="warn">{{ error }}</p>

    <div v-if="loading" class="skeleton">正在加载…</div>

    <div v-else-if="tokens.length === 0" class="empty">
      <p>暂无 API 令牌</p>
      <button class="btn-add" @click="showCreate = true">创建第一个令牌</button>
    </div>

    <div v-else class="list">
      <div v-for="t in tokens" :key="t.id" class="token-card">
        <div class="token-head">
          <span class="token-name">{{ t.name }}</span>
          <span class="token-status" :style="{ color: statusColor(t.status), borderColor: statusColor(t.status) }">
            {{ statusLabel(t.status) }}
          </span>
        </div>
        <div class="token-meta">
          <span>创建：{{ formatDate(t.created_on) }}</span>
          <span>最后使用：{{ formatDate(t.last_used_on) }}</span>
          <span v-if="t.expires_on">过期：{{ formatDate(t.expires_on) }}</span>
          <span v-else>永不过期</span>
        </div>
        <div v-if="(tokenPermsCache.get(t.id) ?? []).length" class="token-perms">
          <span
            v-for="p in (tokenPermsCache.get(t.id) ?? [])"
            :key="p.name"
            class="perm-tag"
            :style="{ color: permLevelColor(p.level), background: permLevelColor(p.level) + '1f' }"
          >
            {{ p.name }} · {{ permLevelLabel(p.level) }}
          </span>
        </div>
        <div class="token-actions">
          <button class="btn-sm btn-rotate" @click="confirmRotateId = t.id">轮换</button>
          <button class="btn-sm btn-del" @click="confirmDeleteId = t.id">删除</button>
        </div>
      </div>
    </div>

    <!-- 创建 Token 弹窗 -->
    <div v-if="showCreate" class="modal-overlay">
      <div class="modal">
        <div class="modal-head">
          <h3>新建 API 令牌</h3>
          <button class="modal-close" @click="closeCreateModal">✕</button>
        </div>

        <!-- 创建成功后显示 Token 值 -->
        <div v-if="createdTokenValue" class="token-result">
          <div class="result-warn">
            ⚠️ 请立即复制保存此令牌值，关闭后无法再次查看。
          </div>
          <div class="token-value-box">
            <code>{{ createdTokenValue }}</code>
            <button class="btn-copy" @click="copyText(createdTokenValue, 'create')">
              {{ copiedCreate ? "已复制" : "复制" }}
            </button>
          </div>
          <button class="btn-done" @click="closeCreateModal">完成</button>
        </div>

        <!-- 创建表单 -->
        <div v-else class="modal-body">
          <div class="field">
            <label>名称</label>
            <input v-model="newName" type="text" placeholder="例如：CI 部署令牌" />
          </div>

          <div class="field">
            <label>权限组（{{ selectedPermIds.length }} 个已选）</label>

            <!-- 分类按钮 -->
            <div class="filter-tabs">
              <button class="filter-tab" :class="{ active: permFilter === 'dns' }" @click="setPermFilter('dns')">编辑区域 DNS</button>
              <button class="filter-tab" :class="{ active: permFilter === 'workers' }" @click="setPermFilter('workers')">编辑 Cloudflare Workers</button>
              <button class="filter-tab" :class="{ active: permFilter === 'database' }" @click="setPermFilter('database')">编辑数据库</button>
              <button class="filter-tab" :class="{ active: permFilter === 'custom' }" @click="setPermFilter('custom')">自定义令牌</button>
            </div>

            <div v-if="permissionGroups.length === 0" class="perm-loading">正在加载权限组…</div>
            <div v-else class="perm-groups">
              <!-- 全局工具栏 -->
              <div class="perm-toolbar">
                <button class="btn-sm btn-selectall" @click="selectAllFiltered">全选</button>
                <button class="btn-sm btn-selectall" @click="selectFilteredRead">全选只读</button>
                <button class="btn-sm btn-selectall" @click="selectFilteredWrite">全选读写</button>
                <button class="btn-sm btn-clear" @click="clearSelection">清空</button>
              </div>

              <!-- 图例 -->
              <div class="legend">
                <span class="legend-item"><span class="dot dot-read"></span>只读</span>
                <span class="legend-item"><span class="dot dot-write"></span>读写</span>
                <span class="legend-item"><span class="dot dot-readonly"></span>仅读（无编辑权限）</span>
                <span class="legend-item"><span class="dot dot-multi"></span>多权限</span>
              </div>

              <!-- 按 scope → service 分组 -->
              <div v-for="[scope, groups] in scopedServiceGroups" :key="scope" class="scope-section">
                <div class="scope-label">{{ scopeLabel(scope) }}</div>

                <div v-for="g in groups" :key="g.service" class="service-card" :class="{ 'service-readonly': g.readOnly }">
                  <div class="service-head">
                    <div class="service-name">{{ serviceCN(g.service) }}</div>
                    <div class="service-badges">
                      <span v-if="g.readOnly" class="badge badge-readonly">仅读</span>
                      <span v-if="g.multiOp" class="badge badge-multi">{{ g.opCount }}权限</span>
                      <button class="btn-sm btn-service" @click="selectService(g)">全选</button>
                      <button v-if="g.hasRead" class="btn-sm btn-service" @click="selectServiceByLevel(g, 'read')">只读</button>
                      <button v-if="g.hasWrite" class="btn-sm btn-service" @click="selectServiceByLevel(g, 'write')">读写</button>
                    </div>
                  </div>
                  <div class="service-ops">
                    <label
                      v-for="p in g.perms"
                      :key="p.pg.id"
                      class="op-chip"
                      :class="{
                        'op-selected': isPermSelected(p.pg.id),
                        'op-read': p.level === 'read',
                        'op-write': p.level === 'write',
                        'op-other': p.level === 'other',
                      }"
                    >
                      <input
                        type="checkbox"
                        :checked="isPermSelected(p.pg.id)"
                        @change="togglePerm(p.pg.id)"
                      />
                      <span :title="p.pg.name">{{ p.op ? opCN(p.op) : permNameCN(p.pg.name) }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div v-if="serviceGroups.length === 0" class="perm-loading">
                该分类下无权限组，点击其他分类查看
              </div>
            </div>
          </div>

          <div class="field">
            <label>有效期</label>
            <select v-model.number="expiresInDays">
              <option :value="0">永不过期</option>
              <option :value="1">1 天</option>
              <option :value="7">7 天</option>
              <option :value="30">30 天</option>
              <option :value="90">90 天</option>
              <option :value="365">1 年</option>
            </select>
          </div>

          <p v-if="error" class="warn">{{ error }}</p>

          <div class="modal-actions">
            <button class="btn-cancel" @click="closeCreateModal">取消</button>
            <button class="btn-confirm" :disabled="creating" @click="handleCreate">
              {{ creating ? "创建中…" : "创建令牌" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="confirmDeleteId" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3>确认删除</h3>
          <button class="modal-close" @click="confirmDeleteId = null">✕</button>
        </div>
        <p class="confirm-text">删除后无法恢复，确定要删除此令牌吗？</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="confirmDeleteId = null">取消</button>
          <button class="btn-del" @click="handleDelete(confirmDeleteId)">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 轮换确认 + 结果 -->
    <div v-if="confirmRotateId" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3>轮换令牌值</h3>
          <button class="modal-close" @click="confirmRotateId = null; rotatedValue = null">✕</button>
        </div>
        <p class="confirm-text">轮换后原令牌值立即失效，将生成新值。确定继续？</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="confirmRotateId = null; rotatedValue = null">取消</button>
          <button class="btn-confirm" @click="handleRotate(confirmRotateId)">确认轮换</button>
        </div>
      </div>
    </div>

    <!-- 轮换结果 -->
    <div v-if="rotatedValue" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3>新令牌值</h3>
          <button class="modal-close" @click="rotatedValue = null">✕</button>
        </div>
        <div class="result-warn">⚠️ 请立即复制保存，关闭后无法再次查看。</div>
        <div class="token-value-box">
          <code>{{ rotatedValue }}</code>
          <button class="btn-copy" @click="copyText(rotatedValue, 'rotate')">
            {{ copiedRotate ? "已复制" : "复制" }}
          </button>
        </div>
        <button class="btn-done" @click="rotatedValue = null">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tokens {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header h2 {
  margin: 0;
  font-size: 20px;
}
.btn-add {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(246, 154, 34, 0.4);
  background: rgba(246, 154, 34, 0.12);
  color: #f69a22;
  font-size: 13px;
  cursor: pointer;
}
.warn {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 122, 110, 0.12);
  color: #ff7a6e;
  font-size: 13px;
}
.skeleton {
  padding: 24px;
  text-align: center;
  color: #8b95a9;
  font-size: 14px;
}
.empty {
  padding: 32px 16px;
  text-align: center;
  color: #8b95a9;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.token-card {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.token-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.token-name {
  font-weight: 600;
  font-size: 15px;
}
.token-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid;
}
.token-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #8b95a9;
}
.token-perms {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.perm-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
}
.token-actions {
  display: flex;
  gap: 8px;
}
.btn-sm {
  padding: 4px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: #aab3c5;
  font-size: 12px;
  cursor: pointer;
}
.btn-rotate {
  border-color: rgba(122, 162, 247, 0.4);
  color: #7aa2f7;
}
.btn-del {
  border-color: rgba(255, 122, 110, 0.3);
  color: #ff7a6e;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal {
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  background: #131c2e;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.modal-sm {
  max-width: 360px;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  background: #131c2e;
  z-index: 1;
}
.modal-head h3 {
  margin: 0;
  font-size: 16px;
}
.modal-close {
  background: none;
  border: none;
  color: #8b95a9;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}
.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field label {
  font-size: 13px;
  color: #aab3c5;
}
.field input[type="text"],
.field select {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #e8edf5;
  font-size: 14px;
}
.perm-loading {
  color: #8b95a9;
  font-size: 13px;
  padding: 8px 0;
}

/* 权限选择区域 */
.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-tab {
  padding: 6px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #aab3c5;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.filter-tab:hover {
  border-color: rgba(246, 154, 34, 0.3);
  color: #e8edf5;
}
.filter-tab.active {
  border-color: rgba(246, 154, 34, 0.5);
  background: rgba(246, 154, 34, 0.15);
  color: #f69a22;
  font-weight: 600;
}
.perm-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.perm-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.perm-toolbar .btn-sm,
.service-badges .btn-sm {
  font-size: 11px;
  padding: 3px 10px;
}
.btn-selectall {
  border-color: rgba(122, 162, 247, 0.3);
  color: #7aa2f7;
}
.btn-clear {
  border-color: rgba(255, 122, 110, 0.3);
  color: #ff7a6e;
}

/* 图例 */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: #8b95a9;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot-read { background: #7aa2f7; }
.dot-write { background: #e0af68; }
.dot-readonly { background: #ff7a6e; }
.dot-multi { background: #bb9af7; }

/* scope 分区 */
.scope-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.scope-label {
  font-size: 11px;
  color: #f69a22;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 0 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.scope-section:first-child .scope-label {
  border-top: none;
  padding-top: 0;
}

/* 服务卡片 */
.service-card {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}
.service-card.service-readonly {
  border-color: rgba(255, 122, 110, 0.2);
  background: rgba(255, 122, 110, 0.04);
}
.service-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}
.service-name {
  font-size: 12px;
  font-weight: 600;
  color: #c0c8d8;
}
.service-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.badge-readonly {
  background: rgba(255, 122, 110, 0.15);
  color: #ff7a6e;
}
.badge-multi {
  background: rgba(187, 154, 247, 0.15);
  color: #bb9af7;
}
.btn-service {
  font-size: 10px !important;
  padding: 2px 8px !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

/* 操作选项 */
.service-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.op-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  cursor: pointer;
  color: #8b95a9;
  user-select: none;
}
.op-chip input[type="checkbox"] {
  width: 12px;
  height: 12px;
  accent-color: #f69a22;
  margin: 0;
}
.op-chip.op-read { border-color: rgba(122, 162, 247, 0.25); }
.op-chip.op-write { border-color: rgba(224, 175, 104, 0.25); }
.op-chip.op-other { border-color: rgba(139, 149, 169, 0.2); }
.op-chip.op-selected {
  color: #e8edf5;
}
.op-chip.op-selected.op-read {
  background: rgba(122, 162, 247, 0.15);
  border-color: #7aa2f7;
}
.op-chip.op-selected.op-write {
  background: rgba(224, 175, 104, 0.15);
  border-color: #e0af68;
}
.op-chip.op-selected.op-other {
  background: rgba(139, 149, 169, 0.15);
  border-color: #8b95a9;
}

/* 模态框底部按钮 */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 20px 20px;
}
.btn-cancel {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: #aab3c5;
  font-size: 13px;
  cursor: pointer;
}
.btn-confirm {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(246, 154, 34, 0.4);
  background: rgba(246, 154, 34, 0.15);
  color: #f69a22;
  font-size: 13px;
  cursor: pointer;
}
.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.confirm-text {
  padding: 16px 20px;
  font-size: 14px;
  color: #c0c8d8;
  margin: 0;
}

/* Token 值展示 */
.token-result {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.result-warn {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(224, 175, 104, 0.12);
  color: #e0af68;
  font-size: 13px;
}
.token-value-box {
  display: flex;
  gap: 8px;
  align-items: center;
}
.token-value-box code {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: #73daca;
  word-break: break-all;
  font-family: "SF Mono", "Cascadia Code", monospace;
}
.btn-copy {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(115, 218, 202, 0.3);
  background: rgba(115, 218, 202, 0.1);
  color: #73daca;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-done {
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #e8edf5;
  font-size: 14px;
  cursor: pointer;
}
</style>
