// 主题配置
export const themes = {
    purple: {
        id: 'purple',
        name: '紫色主题',
        colors: {
            primary: '#667eea',
            primaryEnd: '#764ba2',
            primaryHover: '#7c8ff0',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            gradientHover: 'linear-gradient(135deg, #7c8ff0 0%, #8b5cb8 100%)'
        }
    },
    blue: {
        id: 'blue',
        name: '蓝色主题',
        colors: {
            primary: '#4facfe',
            primaryEnd: '#00f2fe',
            primaryHover: '#6fbdff',
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            gradientHover: 'linear-gradient(135deg, #6fbdff 0%, #20f3ff 100%)'
        }
    },
    green: {
        id: 'green',
        name: '绿色主题',
        colors: {
            primary: '#43e97b',
            primaryEnd: '#38f9d7',
            primaryHover: '#5bed8f',
            gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            gradientHover: 'linear-gradient(135deg, #5bed8f 0%, #52fade 100%)'
        }
    },
    orange: {
        id: 'orange',
        name: '橙色主题',
        colors: {
            primary: '#fa709a',
            primaryEnd: '#fee140',
            primaryHover: '#fb85ab',
            gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            gradientHover: 'linear-gradient(135deg, #fb85ab 0%, #fee85a 100%)'
        }
    },
    pink: {
        id: 'pink',
        name: '粉色主题',
        colors: {
            primary: '#f093fb',
            primaryEnd: '#f5576c',
            primaryHover: '#f3a8fc',
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            gradientHover: 'linear-gradient(135deg, #f3a8fc 0%, #f76f81 100%)'
        }
    }
};

export const defaultTheme = 'purple';

export function applyTheme(themeId) {
    const theme = themes[themeId] || themes[defaultTheme];
    const root = document.documentElement;

    root.style.setProperty('--theme-primary', theme.colors.primary);
    root.style.setProperty('--theme-primary-end', theme.colors.primaryEnd);
    root.style.setProperty('--theme-primary-hover', theme.colors.primaryHover);
    root.style.setProperty('--theme-gradient', theme.colors.gradient);
    root.style.setProperty('--theme-gradient-hover', theme.colors.gradientHover);
}
