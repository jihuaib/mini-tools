<template>
    <div class="rpki-client-container">
        <a-row :gutter="16">
            <a-col :span="24">
                <a-card title="RPKI客户端列表" class="client-card">
                    <a-table
                        :columns="clientColumns"
                        :data-source="clientList"
                        :rowKey="record => `${record.remoteIp || ''}-${record.remotePort || ''}`"
                        :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                        size="small"
                    >
                        <template #bodyCell="{ column, record }">
                            <template v-if="column.key === 'action'">
                                <a-space>
                                    <a-button type="primary" size="small" @click="viewClient(record)">查看</a-button>
                                    <a-button type="primary" size="small" danger @click="confirmDisconnect(record)">断开连接</a-button>
                                </a-space>
                            </template>
                        </template>
                    </a-table>
                </a-card>
            </a-col>
        </a-row>
    </div>
</template>

<script setup>
    import { ref, onMounted, onBeforeUnmount } from 'vue';
    import { message, Modal } from 'ant-design-vue';
    import { useRouter } from 'vue-router';

    defineOptions({
        name: 'RpkiClient'
    });

    const router = useRouter();
    const clientList = ref([]);

    const clientColumns = [
        {
            title: '客户端IP',
            dataIndex: 'remoteIp',
            key: 'remoteIp',
            ellipsis: true,
            width: 150
        },
        {
            title: '客户端端口',
            dataIndex: 'remotePort',
            key: 'remotePort',
            ellipsis: true,
            width: 120
        },
        {
            title: '主机名',
            dataIndex: 'hostname',
            key: 'hostname',
            ellipsis: true
        },
        {
            title: '连接时间',
            dataIndex: 'connectedAt',
            key: 'connectedAt',
            ellipsis: true,
            width: 180,
            customRender: ({ text }) => {
                if (!text) return '';
                const date = new Date(text);
                return date.toLocaleString();
            }
        },
        {
            title: '操作',
            key: 'action',
            width: 180
        }
    ];

    const fetchClientList = async () => {
        try {
            const result = await window.rpkiApi.getClientList();
            if (result.status === 'success') {
                clientList.value = result.data;
            }
        } catch (error) {
            console.error('获取客户端列表失败:', error);
        }
    };

    const viewClient = record => {
        // 构建客户端ID
        const clientId = encodeURIComponent(`${record.remoteIp}|${record.remotePort}`);

        // 导航到客户端详情页面
        router.push({
            name: 'RpkiClientDetail',
            params: {
                clientId
            }
        });
    };

    const confirmDisconnect = record => {
        Modal.confirm({
            title: '确认断开连接',
            content: `是否确认断开与 ${record.remoteIp}:${record.remotePort} 的连接？`,
            okText: '确认',
            cancelText: '取消',
            onOk: () => disconnectClient(record)
        });
    };

    const disconnectClient = async record => {
        try {
            const client = {
                remoteIp: record.remoteIp,
                remotePort: record.remotePort
            };
            const result = await window.rpkiApi.disconnectClient(client);
            if (result.status === 'success') {
                message.success('客户端断开连接成功');
                fetchClientList(); // 刷新列表
            } else {
                message.error(result.msg || '客户端断开连接失败');
            }
        } catch (error) {
            message.error(`客户端断开连接出错: ${error.message}`);
        }
    };

    // 客户端连接状态更新处理程序
    const handleClientConnection = () => {
        fetchClientList();
    };

    // 定期刷新定时器
    let refreshTimer = null;

    onMounted(async () => {
        // 初始获取客户端列表
        await fetchClientList();

        // 设置定时刷新
        refreshTimer = setInterval(fetchClientList, 5000);

        // 添加客户端连接事件监听
        window.addEventListener('rpki:clientConnection', handleClientConnection);
    });

    onBeforeUnmount(() => {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }
        window.removeEventListener('rpki:clientConnection', handleClientConnection);
    });
</script>

<style scoped>
    .rpki-client-container {
        padding: 16px;
    }

    .client-card {
        margin-bottom: 16px;
    }
</style>
