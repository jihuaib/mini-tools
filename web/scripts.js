// Mini-Tools网站脚本

document.addEventListener('DOMContentLoaded', function() {
    // 添加动画类
    const animatedElements = document.querySelectorAll('.header-content, .section-title, .feature-card, .tech-stack');

    animatedElements.forEach((element, index) => {
        element.classList.add('fadeIn');

        // 为元素添加不同的延迟
        if (index % 3 === 0) {
            element.classList.add('delay-1');
        } else if (index % 3 === 1) {
            element.classList.add('delay-2');
        } else {
            element.classList.add('delay-3');
        }
    });

    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 显示当前年份
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // 响应式导航菜单功能
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });
    }

    // 显示工具特性卡片
    function showCards() {
        const cards = document.querySelectorAll('.feature-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100 * index);
        });
    }

    // 页面滚动事件监听
    window.addEventListener('scroll', function() {
        const scrollPosition = window.scrollY;

        // 显示/隐藏回到顶部按钮
        const backToTopButton = document.getElementById('back-to-top');
        if (backToTopButton) {
            if (scrollPosition > 500) {
                backToTopButton.classList.add('show');
            } else {
                backToTopButton.classList.remove('show');
            }
        }

        // 滚动到特定部分时触发动画
        const featureSection = document.getElementById('features');
        if (featureSection) {
            if (scrollPosition + window.innerHeight > featureSection.offsetTop) {
                showCards();
            }
        }
    });

    // 创建回到顶部按钮
    function createBackToTopButton() {
        const button = document.createElement('button');
        button.id = 'back-to-top';
        button.innerHTML = '↑';
        button.style.position = 'fixed';
        button.style.bottom = '20px';
        button.style.right = '20px';
        button.style.width = '50px';
        button.style.height = '50px';
        button.style.borderRadius = '50%';
        button.style.backgroundColor = 'var(--primary-color)';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.fontSize = '20px';
        button.style.cursor = 'pointer';
        button.style.opacity = '0';
        button.style.transition = 'opacity 0.3s ease';
        button.style.zIndex = '1000';
        button.style.boxShadow = 'var(--box-shadow)';

        button.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

        document.body.appendChild(button);
    }

    createBackToTopButton();
});
