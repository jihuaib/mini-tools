<template>
    <div class="rpki-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="rpki-config" tab="RPKI配置" />
                <a-tab-pane key="rpki-client" tab="RPKI客户端" />
                <!-- 为每个活跃的客户端添加动态Tab -->
                <a-tab-pane v-for="client in activeClients" :key="`client-${client.id}`">
                    <template #tab>
                        <a-space :size="2">
                            <a-tooltip :title="client.fullName">
                                {{ client.name }}
                            </a-tooltip>
                            <a-button type="text" size="small" @click.stop="closeClientTab(client.id)" class="close-btn">
                                <close-outlined />
                            </a-button>
                        </a-space>
                    </template>
                </a-tab-pane>
            </a-tabs>
        </div>

        <!-- 可滚动内容区域 -->
        <div class="content-container">
            <router-view v-slot="{ Component }">
                <keep-alive :include="$store.state.cachedViews">
                    <component :is="Component" ref="currentTab" />
                </keep-alive>
            </router-view>
        </div>
    </div>
</template>

<script setup>
    import { ref, onActivated, watch } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { CloseOutlined } from '@ant-design/icons-vue';

    defineOptions({ name: 'RpkiMain' });

    const router = useRouter();
    const route = useRoute();
    const activeTabKey = ref('rpki-config');
    const currentTab = ref(null);
    const activeClients = ref([]);

    const handleTabChange = key => {
        if (key.startsWith('client-')) {
            const clientId = key.substring(7);
            const client = activeClients.value.find(c => c.id === clientId);
            if (client) {
                router.push({
                    name: 'RpkiClientDetail',
                    params: {
                        clientId: client.clientId
                    }
                });
            }
        } else {
            router.push(`/rpki/${key}`);
        }
    };

    const closeClientTab = clientId => {
        const clientIndex = activeClients.value.findIndex(c => c.id === clientId);
        if (clientIndex > -1) {
            activeClients.value.splice(clientIndex, 1);
            if (activeTabKey.value === `client-${clientId}`) {
                if (activeClients.value.length > 0) {
                    const nextClient = activeClients.value[Math.min(clientIndex, activeClients.value.length - 1)];
                    handleTabChange(`client-${nextClient.id}`);
                } else {
                    handleTabChange('rpki-client');
                }
            }
        }
    };

    const addClientTab = async (clientId, name) => {
        const id = clientId;

        if (!activeClients.value.some(c => c.id === id)) {
            try {
                // 获取客户端信息，以便在标签中显示
                const clientIdDecoded = decodeURIComponent(clientId);
                const clientIdArray = clientIdDecoded.split('|');

                if (clientIdArray.length >= 2) {
                    const client = {
                        remoteIp: clientIdArray[0],
                        remotePort: clientIdArray[1]
                    };

                    // 获取客户端信息
                    const clientInfo = await window.rpkiApi.getClient(client);

                    let clientName = client.remoteIp;
                    let fullName = '';

                    if (clientInfo.status === 'success') {
                        clientName = clientInfo.data.hostname || client.remoteIp;
                    }

                    // 完整格式：客户端IP:端口 - 主机名
                    fullName = `${client.remoteIp}:${client.remotePort} - ${clientName}`;

                    // 显示格式：客户端IP @ 主机名简称
                    const shortClientName = clientName.split('.')[0] || client.remoteIp;
                    const displayName = `${client.remoteIp}@${shortClientName}`;

                    activeClients.value.push({
                        id,
                        clientId,
                        name: displayName,
                        fullName
                    });
                } else {
                    // 如果无法解析出客户端信息，则使用默认名称
                    activeClients.value.push({
                        id,
                        clientId,
                        name,
                        fullName: name
                    });
                }
            } catch (error) {
                console.error('获取客户端信息失败', error);
                activeClients.value.push({
                    id,
                    clientId,
                    name,
                    fullName: name
                });
            }
        }

        activeTabKey.value = `client-${id}`;
    };

    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value?.clearValidationErrors) {
                currentTab.value.clearValidationErrors();
            }
        },
        addClientTab
    });

    watch(
        () => route.path,
        async path => {
            if (path === '/rpki/rpki-config') {
                activeTabKey.value = 'rpki-config';
            } else if (path === '/rpki/rpki-client') {
                activeTabKey.value = 'rpki-client';
            } else if (path.startsWith('/rpki/client/')) {
                const clientId = route.params.clientId;
                const id = clientId;
                if (!activeClients.value.some(c => c.id === id)) {
                    try {
                        const clientIdDecoded = decodeURIComponent(clientId);
                        const clientParts = clientIdDecoded.split('|');

                        // 默认显示客户端IP地址
                        let clientName = clientParts[0] || 'Unknown';

                        // 添加客户端信息
                        if (clientParts.length >= 2) {
                            await addClientTab(clientId, `Client ${clientName}`);
                        } else {
                            addClientTab(clientId, `Client ${clientName}`);
                        }
                    } catch (error) {
                        console.error('解析客户端信息失败', error);
                        addClientTab(clientId, 'Unknown Client');
                    }
                }

                activeTabKey.value = `client-${id}`;
            }
        },
        { immediate: true }
    );

    onActivated(() => {
        const path = route.path;
        if (path === '/rpki/rpki-config') {
            activeTabKey.value = 'rpki-config';
        } else if (path === '/rpki/rpki-client') {
            activeTabKey.value = 'rpki-client';
        } else if (path.startsWith('/rpki/client/')) {
            const clientId = route.params.clientId;
            activeTabKey.value = `client-${clientId}`;
        } else {
            activeTabKey.value = 'rpki-config';
            router.push('/rpki/rpki-config');
        }
    });
</script>

<style scoped>
    .rpki-main-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
    }

    .fixed-tabs {
        height: 48px;
        flex-shrink: 0;
        background-color: #fff;
        z-index: 10;
        margin-left: 8px;
    }

    .content-container {
        flex: 1;
        overflow-y: auto;
    }

    .close-btn {
        opacity: 0.5;
        transition: opacity 0.3s;
        margin-left: 1px;
    }

    .close-btn:hover {
        opacity: 1;
    }
</style>
