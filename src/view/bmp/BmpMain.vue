<template>
    <div class="mt-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:active-key="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="bmp-config" tab="BMP配置" />
                <a-tab-pane key="bmp-peer" tab="BMP邻居" />
                <!-- 为每个活跃的peer添加动态Tab -->
                <a-tab-pane v-for="peer in activePeers" :key="`peer-${peer.id}`">
                    <template #tab>
                        <a-space :size="2">
                            {{ peer.peerName }}@{{ peer.clientName }}
                            <a-button type="text" size="small" class="close-btn" @click.stop="closePeerTab(peer.id)">
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
    import { BMP_PEER_STATE } from '../../const/bmpConst';

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

    const addPeerTab = async (clientId, peerId) => {
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

                    let clientName = '';
                    let peerName = '';

                    if (clientInfo.status === 'success') {
                        clientName = clientInfo.data.sysDesc;
                    }

                    if (peerInfo.status === 'success') {
                        peerName = `[${ADDRESS_FAMILY_NAME[peerInfo.data.addrFamilyType]}]${peerInfo.data.peerIp}`;
                    }

                    activePeers.value.push({
                        id,
                        clientId,
                        peerId,
                        peerName,
                        clientName
                    });
                } else {
                    console.error('获取客户端和对等体信息失败', clientId, peerId);
                }
            } catch (error) {
                console.error('获取客户端和对等体信息失败', error);
            }
        }

        activeTabKey.value = `peer-${id}`;
    };

    // 监听客户端和对等体关闭事件
    const handleTermination = terminationInfo => {
        if (terminationInfo && terminationInfo.data) {
            // 客户端终止时，关闭该客户端的所有对等体标签页
            const clientInfo = terminationInfo.data;
            const clientId = `${clientInfo.localIp}|${clientInfo.localPort}|${clientInfo.remoteIp}|${clientInfo.remotePort}`;
            const encodedClientId = encodeURIComponent(clientId);

            // 找到所有与该客户端相关的对等体标签页
            const clientPeers = activePeers.value.filter(p => p.clientId === encodedClientId);
            if (clientPeers.length > 0) {
                // 保存当前标签页状态
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
        if (peerInfo.status === 'success') {
            const data = peerInfo.data;
            if (data) {
                if (data.peerState !== BMP_PEER_STATE.PEER_DOWN) {
                    return;
                }

                const closePeerId = `${data.addrFamilyType}|${data.peerIp}|${data.peerRd}`;
                const encodedClosePeerId = encodeURIComponent(closePeerId);
                const clientPeers = activePeers.value.filter(p => p.peerId === encodedClosePeerId);

                if (clientPeers.length > 0) {
                    // 保存当前标签页状态
                    let shouldRedirect = false;
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
                console.error('peer update handler error', peerInfo.msg);
            }
        } else {
            console.error('peer update handler error', peerInfo.msg);
        }
    };

    const handleInitiation = result => {
        if (result.status === 'success') {
            const clientInfo = result.data;
            if (clientInfo) {
                const clientId = `${clientInfo.localIp}|${clientInfo.localPort}|${clientInfo.remoteIp}|${clientInfo.remotePort}`;
                const encodedClientId = encodeURIComponent(clientId);

                // 找到所有与该客户端相关的对等体标签页
                const clientPeers = activePeers.value.filter(p => p.clientId === encodedClientId);
                if (clientPeers.length > 0) {
                    clientPeers.forEach(peer => {
                        const peerIndex = activePeers.value.findIndex(p => p.id === peer.id);
                        if (peerIndex > -1) {
                            activePeers.value[peerIndex].clientName = clientInfo.sysDesc;
                        }
                    });
                }
            }
        } else {
            console.error('initiation handler error', result.msg);
        }
    };

    // 注册和移除事件监听器
    onMounted(() => {
        window.bmpApi.onTermination(handleTermination);
        window.bmpApi.onPeerUpdate(handlePeerUpdate);
        window.bmpApi.onInitiation(handleInitiation);
    });

    onBeforeUnmount(() => {
        // 只移除当前页面注册的监听器
        window.bmpApi.offTermination(handleTermination);
        window.bmpApi.offPeerUpdate(handlePeerUpdate);
        window.bmpApi.offInitiation(handleInitiation);
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
                        await addPeerTab(clientId, peerId);
                    } catch (error) {
                        console.error('解析对等体信息失败', error);
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
    .close-btn {
        opacity: 0.5;
        transition: opacity 0.3s;
        margin-left: 1px;
    }

    .close-btn:hover {
        opacity: 1;
    }
</style>
