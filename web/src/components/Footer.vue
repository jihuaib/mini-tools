<template>
    <footer class="footer">
        <div class="container footer-content">
            <div class="copyright">© 2025 Mini Tools. All Rights Reserved.</div>
            <div class="links">
                <a href="https://github.com/jihuaib/mini-tools" target="_blank" rel="noopener">GitHub</a>
                <a href="https://github.com/jihuaib/mini-tools/issues" target="_blank" rel="noopener">Support</a>
            </div>
        </div>
    </footer>
</template>

<style scoped>
    .footer {
        background: var(--bg-secondary);
        border-top: 1px solid var(--glass-border);
        padding: 2rem 0;
        margin-top: auto;
    }

    .footer-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--text-secondary);
        font-size: 0.875rem;
    }

    .links {
        display: flex;
        gap: 1.5rem;
    }

    .links a:hover {
        color: var(--accent-primary);
    }

    @media (max-width: 640px) {
        .footer-content {
            flex-direction: column;
            gap: 1rem;
        }
    }
</style>
