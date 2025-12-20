<template>
    <section class="hero">
        <div class="hero-content container">
            <h1 class="hero-title animate-fade-in">
                专业的网络工具集
                <br />
                <span class="gradient-text">重新定义</span>
            </h1>
            <p class="hero-desc animate-fade-in" style="animation-delay: 0.2s">
                Mini Tools 是一个基于 Vue3 + Electron 开发的专业网络和开发辅助工具集。 集成 BGP 模拟器、BMP 监控器、RPKI
                验证器等多种功能于一体。
            </p>
            <div class="hero-actions animate-fade-in" style="animation-delay: 0.4s">
                <button class="btn btn-primary" @click="download">立即下载</button>
                <button class="btn btn-secondary" @click="learnMore">了解更多</button>
            </div>
        </div>
        <div class="hero-background">
            <div class="glow-sphere sphere-1"></div>
            <div class="glow-sphere sphere-2"></div>
        </div>
    </section>
</template>

<script setup>
    const download = () => {
        window.open('https://github.com/jihuaib/NetNexus/releases', '_blank');
    };

    const learnMore = () => {
        document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
    };
</script>

<style scoped>
    .hero {
        position: relative;
        min-height: 100vh;
        display: flex;
        align-items: center;
        overflow: hidden;
        padding-top: 4rem; /* For header if any */
    }

    .hero-content {
        position: relative;
        z-index: 10;
        text-align: center;
        max-width: 800px;
    }

    .hero-title {
        font-size: 4rem;
        font-weight: 800;
        line-height: 1.2;
        margin-bottom: 1.5rem;
        letter-spacing: -0.02em;
    }

    .hero-desc {
        font-size: 1.25rem;
        color: var(--text-secondary);
        margin-bottom: 3rem;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
    }

    .hero-actions {
        display: flex;
        gap: 1.5rem;
        justify-content: center;
    }

    .btn {
        padding: 0.875rem 2rem;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 1rem;
        transition: all 0.3s ease;
    }

    .btn-primary {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        color: white;
        box-shadow: 0 4px 15px var(--accent-glow);
    }

    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px var(--accent-glow);
    }

    .btn-secondary {
        background: var(--glass-bg);
        color: var(--text-primary);
        border: 1px solid var(--glass-border);
    }

    .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .hero-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        pointer-events: none;
    }

    .glow-sphere {
        position: absolute;
        border-radius: 50%;
        filter: blur(100px);
        opacity: 0.4;
    }

    .sphere-1 {
        width: 500px;
        height: 500px;
        background: var(--accent-primary);
        top: -100px;
        left: -200px;
        animation: float 10s infinite alternate;
    }

    .sphere-2 {
        width: 400px;
        height: 400px;
        background: var(--accent-secondary);
        bottom: -50px;
        right: -100px;
        animation: float 8s infinite alternate-reverse;
    }

    @keyframes float {
        0% {
            transform: translate(0, 0);
        }
        100% {
            transform: translate(50px, 50px);
        }
    }

    @media (max-width: 768px) {
        .hero-title {
            font-size: 2.5rem;
        }
    }
</style>
