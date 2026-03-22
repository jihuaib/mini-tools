<template>
    <section id="download" class="download">
        <div class="container">
            <div class="header">
                <h2 class="title">立即下载</h2>
                <p class="subtitle">免费开源，支持 Windows 和 macOS，开箱即用</p>
            </div>

            <div class="cards">
                <!-- Windows -->
                <a class="card glass-card" :href="releasesUrl" target="_blank" rel="noopener">
                    <div class="platform-icon">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 88 88"
                            fill="currentColor"
                        >
                            <path
                                d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349-.011 41.34-47.318-6.678-.066-34.739z"
                            />
                        </svg>
                    </div>
                    <div class="platform-info">
                        <div class="platform-name">Windows</div>
                        <div class="platform-arch">x64 · NSIS 安装包 (.exe)</div>
                    </div>
                    <div class="download-arrow">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </div>
                </a>

                <!-- macOS -->
                <a class="card glass-card" :href="releasesUrl" target="_blank" rel="noopener">
                    <div class="platform-icon">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 814 1000"
                            fill="currentColor"
                        >
                            <path
                                d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.3-151.6-99.1C55.6 732 0 613.7 0 510.2c0-186 121.5-283.9 241.6-283.9 61.8 0 113.5 39.5 151.2 39.5 35.8 0 97.3-42.4 166.3-42.4 26.5 0 108.2 2.5 166.9 91.4zM554.1 158.2c18.2-25 32.4-62.2 32.4-99.4 0-5.1-.6-10.3-1.3-15.4-31.1 1.3-68.7 21.4-91.4 48.8-18.8 22.4-35.2 59-35.2 96.8 0 5.8.6 11.5 1.3 13.3 2.5.6 6.4 1.3 10.3 1.3 27.5 0 62.9-18.8 83.9-45.4z"
                            />
                        </svg>
                    </div>
                    <div class="platform-info">
                        <div class="platform-name">macOS</div>
                        <div class="platform-arch">x64 / arm64 (Apple Silicon) · DMG</div>
                    </div>
                    <div class="download-arrow">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </div>
                </a>
            </div>

            <div class="all-releases">
                <a :href="releasesUrl" target="_blank" rel="noopener">查看所有版本 &rarr;</a>
            </div>
        </div>
    </section>
</template>

<script setup>
    const releasesUrl = 'https://github.com/jihuaib/NetNexus/releases';
</script>

<style scoped>
    .download {
        padding: 6rem 2rem;
        background: var(--bg-secondary);
        border-top: 1px solid var(--glass-border);
    }

    .header {
        text-align: center;
        margin-bottom: 3rem;
    }

    .title {
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 0.75rem;
        background: linear-gradient(to right, #fff, #94a3b8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .subtitle {
        font-size: 1.1rem;
        color: var(--text-secondary);
    }

    .cards {
        display: flex;
        gap: 1.5rem;
        justify-content: center;
        flex-wrap: wrap;
        max-width: 800px;
        margin: 0 auto;
    }

    .card {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding: 1.75rem 2rem;
        border-radius: 16px;
        flex: 1;
        min-width: 280px;
        max-width: 360px;
        text-decoration: none;
        color: var(--text-primary);
        transition:
            transform 0.25s ease,
            box-shadow 0.25s ease,
            border-color 0.25s ease;
        cursor: pointer;
    }

    .card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        border-color: rgba(99, 102, 241, 0.5);
    }

    .platform-icon {
        color: var(--accent-primary);
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .platform-info {
        flex: 1;
    }

    .platform-name {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
    }

    .platform-arch {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }

    .download-arrow {
        color: var(--accent-primary);
        opacity: 0.7;
        transition:
            opacity 0.2s,
            transform 0.2s;
    }

    .card:hover .download-arrow {
        opacity: 1;
        transform: translateY(2px);
    }

    .all-releases {
        text-align: center;
        margin-top: 2rem;
    }

    .all-releases a {
        color: var(--text-secondary);
        font-size: 0.9rem;
        transition: color 0.2s;
    }

    .all-releases a:hover {
        color: var(--accent-primary);
    }
</style>
