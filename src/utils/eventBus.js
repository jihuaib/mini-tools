/**
 * 渲染进程事件总线
 * 用于在渲染进程内部进行事件分发，避免通过 contextBridge 传递函数导致的代理引用问题
 */
class EventBus {
    constructor() {
        this.handlers = new Map(); // 可以注册多个事件监听器
    }

    /**
     * 注册事件监听器
     * @param {string} eventType 事件类型
     * @param {string} id 事件ID, 每个页面的事件ID必须唯一
     * @param {Function} handler 事件处理函数
     */
    on(eventType, id, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Map());
        }
        this.handlers.get(eventType).set(id, handler);
    }

    /**
     * 移除事件监听器
     * @param {string} eventType 事件类型
     * @param {string} id 事件ID, 每个页面的事件ID必须唯一
     */
    off(eventType, id) {
        if (this.handlers.has(eventType)) {
            this.handlers.get(eventType).delete(id);
        }
    }

    /**
     * 分发事件
     * @param {string} eventType 事件类型
     * @param {any} data 事件数据
     */
    emit(eventType, data) {
        if (this.handlers.has(eventType)) {
            this.handlers.get(eventType).forEach((handler, _id) => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`EventBus error for ${eventType}:`, error);
                }
            });
        }
    }

    /**
     * 清理所有监听器
     */
    clear() {
        this.handlers.clear();
    }
}

const eventBus = new EventBus();

export default eventBus;
