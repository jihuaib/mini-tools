<template>
    <div class="bmp-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="bmp-config" tab="BMP配置" />
                <a-tab-pane key="bmp-peer" tab="BMP邻居" />
                <!-- 为每个活跃的peer添加动态Tab -->
                <a-tab-pane v-for="peer in activePeers" :key="`peer-${peer.id}`">
                    <template #tab>
                        <a-space :size="2">
                            <a-tooltip :title="peer.fullName">
                                {{ peer.name }}
                            </a-tooltip>
                            <a-button type="text" size="small" @click.stop="closePeerTab(peer.id)" class="close-btn">
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
    import { ref, onActivated, watch, onMounted, onBeforeUnmount } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { CloseOutlined } from '@ant-design/icons-vue';
    import { ADDRESS_FAMILY_NAME } from '../../const/bgpConst';

    defineOptions({ name: 'BmpMain' });

    const router = useRouter();
    const route = useRoute();
    const activeTabKey = ref('bmp-config');
    const currentTab = ref(null);
    const activePeers = ref([]);

    const handleTabChange = key => {
        if (key.startsWith('peer-')) {
            const peerId = key.substring(5);
            const peer = activePeers.value.find(p => p.id === peerId);
            if (peer) {
                router.push({
                    name: 'BmpPeerRoute',
                    params: {
                        clientId: peer.clientId,
                        peerId: peer.peerId
                    }
                });
            }
        } else {
            router.push(`/bmp/${key}`);
        }
    };

    const closePeerTab = peerId => {
        const peerIndex = activePeers.value.findIndex(p => p.id === peerId);
        if (peerIndex > -1) {
            activePeers.value.splice(peerIndex, 1);
            if (activeTabKey.value === `peer-${peerId}`) {
                if (activePeers.value.length > 0) {
                    const nextPeer = activePeers.value[Math.min(peerIndex, activePeers.value.length - 1)];
                    handleTabChange(`peer-${nextPeer.id}`);
                } else {
                    handleTabChange('bmp-peer');
                }
            }
        }
    };

    const addPeerTab = async (clientId, peerId, name) => {
        const id = `${clientId}|${peerId}`;

        if (!activePeers.value.some(p => p.id === id)) {
            try {
                // 获取客户端信息，以便在标签中显示
                const clientIdDecoded = decodeURIComponent(clientId);
                const peerIdDecoded = decodeURIComponent(peerId);
                const clientIdArray = clientIdDecoded.split('|');
                const peerIdArray = peerIdDecoded.split('|');

                if (clientIdArray.length >= 4 && peerIdArray.length >= 2) {
                    const client = {
                        localIp: clientIdArray[0],
                        localPort: clientIdArray[1],
                        remoteIp: clientIdArray[2],
                        remotePort: clientIdArray[3]
                    };
                    const peer = {
                        addrFamilyType: peerIdArray[0],
                        peerIp: peerIdArray[1],
                        peerRd: peerIdArray[2]
                    };

                    // 获取客户端和对等体信息
                    const clientInfo = await window.bmpApi.getClient(client);
                    const peerInfo = await window.bmpApi.getPeer(client, peer);

                    let clientName = client.remoteIp;
                    let peerName = peer.peerIp;
                    let fullName = '';

                    if (clientInfo.status === 'success') {
                        clientName = clientInfo.data.sysDesc || client.remoteIp;
                    }

                    if (peerInfo.status === 'success') {
                        peerName = `[${ADDRESS_FAMILY_NAME[peerInfo.data.addrFamilyType]}]${peerInfo.data.peerIp}`;
                    }

                    // 完整格式：客户端 - 对等体
                    fullName = `${clientName} - ${peerName}`;

                    // 显示格式：对等体 @ 客户端简称
                    const shortClientName = clientName.split(' ')[0] || client.remoteIp;
                    const displayName = `${peerName}@${shortClientName}`;

                    activePeers.value.push({
                        id,
                        clientId,
                        peerId,
                        name: displayName,
                        fullName
                    });
                } else {
                    // 如果无法解析出客户端和对等体信息，则使用默认名称
                    activePeers.value.push({
                        id,
                        clientId,
                        peerId,
                        name,
                        fullName: name
                    });
                }
            } catch (error) {
                console.error('获取客户端和对等体信息失败', error);
                activePeers.value.push({
                    id,
                    clientId,
                    peerId,
                    name,
                    fullName: name
                });
            }
        }

        activeTabKey.value = `peer-${id}`;
    };

    // 监听客户端和对等体关闭事件
    const handleTermination = terminationInfo => {
        console.log('handleTermination', terminationInfo);
        if (terminationInfo && terminationInfo.data) {
            // 客户端终止时，关闭该客户端的所有对等体标签页
            const clientInfo = terminationInfo.data;
            const clientId = `${clientInfo.localIp}|${clientInfo.localPort}|${clientInfo.remoteIp}|${clientInfo.remotePort}`;
            const encodedClientId = encodeURIComponent(clientId);

            // 找到所有与该客户端相关的对等体标签页
            const clientPeers = activePeers.value.filter(p => p.clientId === encodedClientId);
            if (clientPeers.length > 0) {
                // 保存当前标签页状态
                const currentKey = activeTabKey.value;
                let shouldRedirect = false;

                // 删除所有与该客户端相关的对等体标签页
                clientPeers.forEach(peer => {
                    const peerIndex = activePeers.value.findIndex(p => p.id === peer.id);
                    if (peerIndex > -1) {
                        activePeers.value.splice(peerIndex, 1);
                        if (activeTabKey.value === `peer-${peer.id}`) {
                            shouldRedirect = true;
                        }
                    }
                });

                // 如果当前标签页是被删除的某个对等体，则重定向到BMP邻居页
                if (shouldRedirect) {
                    activeTabKey.value = 'bmp-peer';
                    router.push('/bmp/bmp-peer');
                }
            }
        } else {
            // BMP 服务终止时，关闭所有标签页
            if (activePeers.value.length > 0) {
                // 保存当前标签页状态
                const currentKey = activeTabKey.value;

                // 清空所有标签页
                activePeers.value = [];

                // 如果当前是对等体标签页，则切换到BMP邻居页
                if (currentKey.startsWith('peer-')) {
                    activeTabKey.value = 'bmp-peer';
                    router.push('/bmp/bmp-peer');
                }
            }
        }
    };

    const handlePeerUpdate = peerInfo => {
        console.log('handlePeerUpdate', peerInfo);
        // 当对等体状态更新且状态为"DOWN"时关闭对应标签页
        if (peerInfo && peerInfo.operation === 'down' && peerInfo.client && peerInfo.peer) {
            const clientInfo = peerInfo.client;
            const peerData = peerInfo.peer;

            const clientId = `${clientInfo.localIp}|${clientInfo.localPort}|${clientInfo.remoteIp}|${clientInfo.remotePort}`;
            const peerId = `${peerData.addrFamilyType}|${peerData.peerIp}|${peerData.peerRd || ''}`;

            const id = `${encodeURIComponent(clientId)}|${encodeURIComponent(peerId)}`;

            // 查找并关闭对应的标签页
            const peerIndex = activePeers.value.findIndex(p => p.id === id);
            if (peerIndex > -1) {
                closePeerTab(id);
            }
        }
    };

    // 注册和移除事件监听器
    onMounted(() => {
        window.bmpApi.onTermination(handleTermination);
        window.bmpApi.onPeerUpdate(handlePeerUpdate);
    });

    onBeforeUnmount(() => {
        // 只移除当前页面注册的监听器
        window.bmpApi.offTermination(handleTermination);
        window.bmpApi.offPeerUpdate(handlePeerUpdate);
    });

    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value?.clearValidationErrors) {
                currentTab.value.clearValidationErrors();
            }
        },
        addPeerTab
    });

    watch(
        () => route.path,
        async path => {
            if (path === '/bmp/bmp-config') {
                activeTabKey.value = 'bmp-config';
            } else if (path === '/bmp/bmp-peer') {
                activeTabKey.value = 'bmp-peer';
            } else if (path.startsWith('/bmp/peer/')) {
                const clientId = route.params.clientId;
                const peerId = route.params.peerId;
                const id = `${clientId}|${peerId}`;
                if (!activePeers.value.some(p => p.id === id)) {
                    try {
                        const peerIdDecoded = decodeURIComponent(peerId);
                        const clientIdDecoded = decodeURIComponent(clientId);
                        const peerParts = peerIdDecoded.split('|');
                        const clientParts = clientIdDecoded.split('|');

                        // 默认显示对等体IP地址
                        let peerName = peerParts[1] || 'Unknown';

                        // 添加客户端信息
                        if (clientParts.length >= 3) {
                            await addPeerTab(clientId, peerId, `Peer ${peerName}`);
                        } else {
                            addPeerTab(clientId, peerId, `Peer ${peerName}`);
                        }
                    } catch (error) {
                        console.error('解析对等体信息失败', error);
                        addPeerTab(clientId, peerId, 'Unknown Peer');
                    }
                }

                activeTabKey.value = `peer-${id}`;
            }
        },
        { immediate: true }
    );

    onActivated(() => {
        const path = route.path;
        if (path === '/bmp/bmp-config') {
            activeTabKey.value = 'bmp-config';
        } else if (path === '/bmp/bmp-peer') {
            activeTabKey.value = 'bmp-peer';
        } else if (path.startsWith('/bmp/peer/')) {
            const clientId = route.params.clientId;
            const peerId = route.params.peerId;
            activeTabKey.value = `peer-${clientId}|${peerId}`;
        } else {
            activeTabKey.value = 'bmp-config';
            router.push('/bmp/bmp-config');
        }
    });
</script>

<style scoped>
    .bmp-main-container {
        display: flex;
        flex-direction: column;
        height: 100vh; /* 确保撑满屏幕 */
        overflow: hidden;
    }

    .fixed-tabs {
        height: 48px; /* 你实际 Tab 高度 */
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
