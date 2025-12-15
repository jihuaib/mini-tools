<template>
    <header class="header">
        <div class="container header-container">
            <div class="logo">
                <span class="logo-text">Mini Tools</span>
            </div>
            <div class="github-info">
                <a href="https://github.com/jihuaib/mini-tools" target="_blank" class="github-link">
                    <svg
                        height="24"
                        viewBox="0 0 16 16"
                        version="1.1"
                        width="24"
                        aria-hidden="true"
                        class="github-icon"
                    >
                        <path
                            fill="currentColor"
                            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                        ></path>
                    </svg>
                    <span class="repo-name">jihuaib/mini-tools</span>
                </a>
                <div class="stats">
                    <a href="https://github.com/jihuaib/mini-tools/stargazers" target="_blank">
                        <img
                            src="https://img.shields.io/github/stars/jihuaib/mini-tools?style=flat-square&color=1890ff&label=Stars"
                            alt="GitHub stars"
                        />
                    </a>
                    <a
                        href="https://github.com/jihuaib/mini-tools/network/members"
                        target="_blank"
                        style="margin-left: 8px"
                    >
                        <img
                            src="https://img.shields.io/github/forks/jihuaib/mini-tools?style=flat-square&color=1890ff&label=Forks"
                            alt="GitHub forks"
                        />
                    </a>
                </div>
            </div>
        </div>
    </header>
</template>

<style scoped>
    .header {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        padding: 1rem 0;
        background: rgba(0, 21, 41, 0.85); /* Matches new blue bg */
        backdrop-filter: blur(12px);
        z-index: 1000;
        border-bottom: 1px solid var(--glass-border);
    }

    .header-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .logo-text {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .github-info {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    .github-link {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-primary);
        font-weight: 500;
    }

    .github-link:hover {
        color: var(--accent-primary);
    }

    .repo-name {
        font-size: 0.9rem;
    }

    .stats {
        display: flex;
        align-items: center;
    }

    .stats img {
        height: 20px;
    }

    @media (max-width: 640px) {
        .github-info {
            gap: 0.5rem;
        }
        .repo-name {
            display: none;
        }
    }
</style>
