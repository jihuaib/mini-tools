<template>
    <section id="features" class="features container">
        <div class="header">
            <h2 class="title text-gradient">强大功能</h2>
            <p class="subtitle">满足您对网络协议模拟和分析的所有需求。</p>
        </div>

        <div class="grid">
            <div
                v-for="(feature, index) in features"
                :key="index"
                class="card glass-card"
                :style="{ 'animation-delay': `${index * 0.1}s` }"
            >
                <div class="icon-wrapper">
                    <span class="icon" v-html="feature.icon"></span>
                </div>
                <h3 class="card-title">{{ feature.title }}</h3>
                <p class="card-desc">{{ feature.desc }}</p>
            </div>
        </div>
    </section>
</template>

<script setup>
    const features = [
        {
            title: 'BGP 模拟器',
            desc: '模拟 BGP Speaker，支持多对等体并发连接、IPv4 / IPv6 / MVPN 路由下发与撤销，实时查看对等体状态和路由表。',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>'
        },
        {
            title: 'BMP 监控器',
            desc: '作为 BMP Server 接收路由器上报的 BGP 报文，实时展示 BGP 会话列表、Loc-RIB 路由表及会话 / 路由统计报告。',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>'
        },
        {
            title: 'RPKI 验证器',
            desc: '内置 RPKI RTR Server，管理 ROA 条目并向路由器提供路由源验证服务，支持 IPv4 / IPv6 前缀和 AS 号配置。',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'
        },
        {
            title: 'SNMP 管理器',
            desc: '作为 SNMP Manager 接收并展示来自网络设备的 Trap 消息，支持 SNMPv1 / v2c / v3 及多实例并发管理。',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>'
        },
        {
            title: 'FTP 服务器',
            desc: '内置轻量 FTP Server，支持多用户账号管理、权限控制和文件传输，可快速为测试设备提供文件服务。',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>'
        },
        {
            title: '报文解析器',
            desc: '支持以太网 / IP / TCP / UDP / ARP / BGP 协议报文的逐层解析与结构化展示，同时支持自定义报文捕获和历史记录回放。',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>'
        },
        {
            title: '开发辅助工具',
            desc: '集成字符串生成器、格式化工具（JSON / XML / Hex）、端口监控、网络信息查看等常用开发工具，一站式满足调试需求。',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'
        },
        {
            title: 'TCP-AO MAC 计算器',
            desc: '遵循 RFC 5925，输入密钥、SNE 和 IPv4 报文，自动提取伪头部并计算 MD5 MAC 和 MAC-96，支持 TCP 选项灵活裁剪。',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>'
        }
    ];
</script>

<style scoped>
    .features {
        padding: 6rem 2rem;
    }

    .header {
        text-align: center;
        margin-bottom: 4rem;
    }

    .title {
        font-size: 3rem;
        font-weight: 700;
        margin-bottom: 1rem;
    }

    .title.text-gradient {
        background: linear-gradient(to right, #fff, #94a3b8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .subtitle {
        font-size: 1.25rem;
        color: var(--text-secondary);
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 2rem;
    }

    .card {
        padding: 2rem;
        transition:
            transform 0.3s ease,
            box-shadow 0.3s ease;
        cursor: default;
    }

    .card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .icon-wrapper {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2));
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1.5rem;
        color: var(--accent-primary);
    }

    .card-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: var(--text-primary);
    }

    .card-desc {
        color: var(--text-secondary);
        line-height: 1.6;
    }
</style>
