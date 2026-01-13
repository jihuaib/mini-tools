/**
 * Ant Design Vue 全局主题配置
 * 定义应用程序的统一视觉风格
 */

// 渐变色定义
export const gradients = {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    primaryHover: 'linear-gradient(135deg, #7c8ff0 0%, #8b5cb8 100%)',
    secondary: 'linear-gradient(135deg, #667eea 0%, #4facfe 100%)',
    light: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
};

export const themeConfig = {
    token: {
        // ===== 颜色系统 =====
        // 主色调 - 渐变紫蓝色系
        colorPrimary: '#667eea',
        colorPrimaryBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        colorPrimaryBgHover: 'linear-gradient(135deg, #7c8ff0 0%, #8b5cb8 100%)',

        // 成功色
        colorSuccess: '#52c41a',

        // 警告色
        colorWarning: '#faad14',

        // 错误色
        colorError: '#ff4d4f',

        // 信息色
        colorInfo: '#1890ff',

        // ===== 文本颜色 =====
        colorTextBase: '#000000',
        colorText: 'rgba(0, 0, 0, 0.85)',
        colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
        colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
        colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',

        // ===== 边框和分割线 =====
        colorBorder: '#d9d9d9',
        colorBorderSecondary: '#f0f0f0',

        // ===== 背景色 =====
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBgLayout: '#f5f5f5',

        // ===== 字体 =====
        fontSize: 14,
        fontSizeHeading1: 38,
        fontSizeHeading2: 30,
        fontSizeHeading3: 24,
        fontSizeHeading4: 20,
        fontSizeHeading5: 16,
        fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",

        // ===== 圆角 =====
        borderRadius: 6,
        borderRadiusLG: 8,
        borderRadiusSM: 4,
        borderRadiusXS: 2,

        // ===== 间距 =====
        padding: 16,
        paddingLG: 24,
        paddingSM: 12,
        paddingXS: 8,
        paddingXXS: 4,

        margin: 16,
        marginLG: 24,
        marginSM: 12,
        marginXS: 8,
        marginXXS: 4,

        // ===== 阴影 =====
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        boxShadowSecondary: '0 1px 2px rgba(0, 0, 0, 0.08)',

        // ===== 控制组件高度 =====
        controlHeight: 32,
        controlHeightLG: 40,
        controlHeightSM: 24
    },
    // 全局组件尺寸
    componentSize: 'small',

    components: {
        // ===== 按钮组件 =====
        Button: {
            primaryShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            controlHeight: 32,
            controlHeightLG: 40,
            controlHeightSM: 24,
            fontSize: 14,
            borderRadius: 6,
            colorPrimary: '#667eea',
            colorPrimaryHover: '#7c8ff0'
        },

        // ===== 输入框组件 =====
        Input: {
            controlHeight: 32,
            fontSize: 14,
            borderRadius: 6,
            paddingBlock: 4,
            paddingInline: 11
        },

        // ===== 选择器组件 =====
        Select: {
            controlHeight: 32,
            fontSize: 14,
            borderRadius: 6
        },

        // ===== 表格组件 =====
        Table: {
            fontSize: 13,
            cellPaddingBlock: 8,
            cellPaddingInline: 8,
            headerBg: '#fafafa',
            headerColor: 'rgba(0, 0, 0, 0.85)',
            rowHoverBg: '#f5f5f5',
            borderColor: '#f0f0f0'
        },

        // ===== 卡片组件 =====
        Card: {
            headerFontSize: 14,
            headerHeight: 40,
            paddingLG: 10,
            borderRadiusLG: 8
        },

        // ===== 标签页组件 =====
        Tabs: {
            fontSize: 14,
            cardHeight: 40,
            horizontalMargin: '0 0 16px 0',
            itemColor: 'rgba(0, 0, 0, 0.65)',
            itemSelectedColor: '#667eea',
            itemHoverColor: '#7c8ff0',
            inkBarColor: '#667eea'
        },

        // ===== 模态框组件 =====
        Modal: {
            headerBg: '#ffffff',
            titleFontSize: 16,
            titleLineHeight: 1.5,
            contentBg: '#ffffff',
            footerBg: '#ffffff',
            borderRadiusLG: 8
        },

        // ===== 消息提示组件 =====
        Message: {
            contentBg: '#ffffff',
            contentPadding: '10px 16px',
            borderRadiusLG: 8
        },

        // ===== 通知组件 =====
        Notification: {
            width: 384,
            borderRadiusLG: 8
        },

        // ===== 表单组件 =====
        Form: {
            labelFontSize: 14,
            labelColor: 'rgba(0, 0, 0, 0.85)',
            itemMarginBottom: 8,
            verticalLabelPadding: '0 0 4px'
        },

        // ===== 分割线组件 =====
        Divider: {
            fontSize: 12,
            textPaddingInline: 16,
            orientationMargin: 0.05
        },

        // ===== 工具提示组件 =====
        Tooltip: {
            fontSize: 12,
            borderRadius: 4,
            colorBgSpotlight: 'rgba(0, 0, 0, 0.85)'
        },

        // ===== 开关组件 =====
        Switch: {
            colorPrimary: '#667eea',
            colorPrimaryHover: '#7c8ff0'
        },

        // ===== 复选框组件 =====
        Checkbox: {
            colorPrimary: '#667eea',
            colorPrimaryHover: '#7c8ff0',
            borderRadiusSM: 4
        },

        // ===== 单选框组件 =====
        Radio: {
            colorPrimary: '#667eea',
            dotSize: 8
        },

        // ===== 标签组件 =====
        Tag: {
            fontSize: 12,
            lineHeight: 1.5,
            borderRadiusSM: 4
        },

        // ===== 徽标组件 =====
        Badge: {
            fontSize: 12,
            fontSizeSM: 10,
            dotSize: 6
        }
    }
};

export default themeConfig;
