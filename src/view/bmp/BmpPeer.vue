<template>
    <div class="mt-container">
        <a-row>
            <a-col :span="24">
                <a-card title="BMP Client">
                    <div v-if="clientList.length > 0">
                        <a-tabs v-model:activeKey="activeClientKey">
                            <a-tab-pane
                                v-for="client in clientList"
                                :key="`${client.localIp}|${client.localPort}|${client.remoteIp}|${client.remotePort}`"
                                :tab="`${client.sysDesc}[${client.remoteIp}]`"
                            >
                                <div class="bgp-peer-info-header">
                                    <UnorderedListOutlined />
                                    <span class="bgp-peer-info-header-text">BGP邻居列表</span>
                                    <a-tag v-if="peerList.length > 0" color="blue">
                                        {{ peerList.length }}
                                    </a-tag>
                                </div>
                                <a-table
                                    :columns="peerColumns"
                                    :data-source="peerList"
                                    :row-key="record => `${record.addrFamilyType}|${record.peerIp}|${record.peerRd}`"
                                    :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                    :scroll="{ y: 400, x: 900 }"
                                    size="small"
                                >
                                    <template #bodyCell="{ column, record }">
                                        <template v-if="column.key === 'action'">
                                            <a-space size="small">
                                                <a-button type="primary" size="small" @click="viewPeerDetails(record)">
                                                    <template #icon><InfoCircleOutlined /></template>
                                                    详情
                                                </a-button>
                                                <a-button type="primary" size="small" @click="viewPeerRoutes(record)">
                                                    <template #icon><ZoomInOutlined /></template>
                                                    查看路由
                                                </a-button>
                                            </a-space>
                                        </template>
                                    </template>
                                </a-table>
                            </a-tab-pane>
                        </a-tabs>
                    </div>

                    <div v-else class="no-result-message">
                        <a-empty description="请先启动BMP服务" />
                    </div>
                </a-card>
            </a-col>
        </a-row>

        <a-drawer
            v-model:open="detailsDrawerVisible"
            :title="detailsDrawerTitle"
            placement="right"
            width="500px"
            @close="closeDetailsDrawer"
        >
            <pre v-if="currentDetails">{{ JSON.stringify(currentDetails, null, 2) }}</pre>
        </a-drawer>
    </div>
</template>

<script setup>
    import { ref, onMounted, onActivated, watch, onBeforeUnmount } from 'vue';
    import { message } from 'ant-design-vue';
    import { UnorderedListOutlined, InfoCircleOutlined, ZoomInOutlined } from '@ant-design/icons-vue';
    import { useRouter } from 'vue-router';
    import { BMP_PEER_TYPE_NAME, BMP_PEER_FLAGS_NAME, BMP_PEER_STATE_NAME, BMP_PEER_STATE } from '../../const/bmpConst';
    import { ADDRESS_FAMILY_NAME } from '../../const/bgpConst';
    defineOptions({
        name: 'BmpPeer'
    });

    // 客户端
    const clientList = ref([]);
    const activeClientKey = ref('');

    const peerList = ref([]);

    // 对等体列表
    const peerColumns = [
        {
            title: '地址族',
            dataIndex: 'addrFamilyType',
            key: 'addrFamilyType',
            ellipsis: true,
            width: 100,
            customRender: ({ text }) => {
                return ADDRESS_FAMILY_NAME[text] || text;
            }
        },
        {
            title: 'Peer Type',
            dataIndex: 'peerType',
            key: 'peerType',
            ellipsis: true,
            width: 100,
            customRender: ({ text }) => {
                return BMP_PEER_TYPE_NAME[text] || text;
            }
        },
        {
            title: 'Peer IP',
            dataIndex: 'peerIp',
            key: 'peerIp',
            width: 100,
            ellipsis: true
        },
        {
            title: 'AS',
            dataIndex: 'peerAs',
            key: 'peerAs',
            width: 100,
            ellipsis: true
        },
        {
            title: 'RD',
            dataIndex: 'peerRd',
            key: 'peerRd',
            width: 100,
            ellipsis: true
        },
        {
            title: 'Router ID',
            dataIndex: 'peerRouterId',
            key: 'peerRouterId',
            width: 100,
            ellipsis: true
        },
        {
            title: 'Peer Flags',
            dataIndex: 'peerFlags',
            key: 'peerFlags',
            ellipsis: true,
            width: 80,
            customRender: ({ text }) => {
                return Object.keys(BMP_PEER_FLAGS_NAME)
                    .filter(key => text & key)
                    .map(key => BMP_PEER_FLAGS_NAME[key])
                    .join(', ');
            }
        },
        {
            title: 'Peer状态',
            dataIndex: 'peerState',
            key: 'peerState',
            ellipsis: true,
            width: 100,
            customRender: ({ text }) => {
                return BMP_PEER_STATE_NAME[text] || text;
            }
        },
        {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 200
        }
    ];

    // Details drawer
    const detailsDrawerVisible = ref(false);
    const detailsDrawerTitle = ref('');
    const currentDetails = ref(null);

    // View peer details
    const viewPeerDetails = record => {
        currentDetails.value = record;
        detailsDrawerTitle.value = `Peer 详情: ${record.peerIp}`;
        detailsDrawerVisible.value = true;
    };

    // Close details drawer
    const closeDetailsDrawer = () => {
        detailsDrawerVisible.value = false;
        currentDetails.value = null;
    };

    const router = useRouter();

    const viewPeerRoutes = record => {
        const [localIp, localPort, remoteIp, remotePort] = activeClientKey.value.split('|');
        const clientKey = `${localIp}|${localPort}|${remoteIp}|${remotePort}`;
        const peerKey = `${record.addrFamilyType}|${record.peerIp}|${record.peerRd}`;

        router.push({
            name: 'BmpPeerRoute',
            params: {
                clientId: encodeURIComponent(clientKey),
                peerId: encodeURIComponent(peerKey)
            }
        });
    };

    const onTerminationHandler = result => {
        if (result.status === 'success') {
            const data = result.data;
            if (data) {
                // 特定客户端终止的情况
                const existingIndex = clientList.value.findIndex(
                    client =>
                        `${client.localIp || ''}-${client.localPort || ''}-${client.remoteIp || ''}-${client.remotePort || ''}` ===
                        `${data.localIp || ''}-${data.localPort || ''}-${data.remoteIp || ''}-${data.remotePort || ''}`
                );
                if (existingIndex !== -1) {
                    clientList.value.splice(existingIndex, 1);

                    if (clientList.value.length > 0 && !activeClientKey.value) {
                        activeClientKey.value = `${clientList.value[0].localIp}|${clientList.value[0].localPort}|${clientList.value[0].remoteIp}|${clientList.value[0].remotePort}`;
                    }
                }
            } else {
                // BMP 服务停止，清空所有数据
                clientList.value = [];
                activeClientKey.value = '';
                peerList.value = [];
            }

            if (clientList.value.length === 0) {
                activeClientKey.value = '';
                peerList.value = [];
            }
        } else {
            console.error('termination handler error', result.msg);
        }
    };

    onMounted(async () => {
        // 监听对等体更新事件
        window.bmpApi.onPeerUpdate(onPeerUpdate);

        // 监听Client列表更新事件
        window.bmpApi.onInitiation(onClientListUpdate);
        window.bmpApi.onTermination(onTerminationHandler);
    });

    const onPeerUpdate = result => {
        if (result.status === 'success') {
            const peerData = result.data;
            // 创建唯一标识符
            const peerKey = `${peerData.addrFamilyType}|${peerData.peerIp}|${peerData.peerRd}`;

            // 查找现有记录
            const existingIndex = peerList.value.findIndex(
                peer => `${peer.addrFamilyType}|${peer.peerIp}|${peer.peerRd}` === peerKey
            );

            if (existingIndex !== -1) {
                // 更新现有记录
                if (peerData.peerState === BMP_PEER_STATE.PEER_UP) {
                    peerList.value[existingIndex] = peerData;
                } else {
                    peerList.value.splice(existingIndex, 1);
                }
            } else {
                // 使用展开运算符创建新数组以确保响应式更新
                if (peerList.value.length === 0) {
                    // 首次添加，直接赋值一个新数组以确保触发响应式更新
                    peerList.value = [peerData];
                } else {
                    peerList.value = [...peerList.value, peerData];
                }
            }
        } else {
            message.error('获取BGP邻居列表失败');
        }
    };

    const onClientListUpdate = result => {
        if (result.status === 'success') {
            // 存在则更新，否则添加
            const existingIndex = clientList.value.findIndex(
                client =>
                    `${client.localIp || ''}-${client.localPort || ''}-${client.remoteIp || ''}-${client.remotePort || ''}` ===
                    `${result.data.localIp || ''}-${result.data.localPort || ''}-${result.data.remoteIp || ''}-${result.data.remotePort || ''}`
            );
            if (existingIndex !== -1) {
                clientList.value[existingIndex] = result.data;
            } else {
                clientList.value.push(result.data);
            }
            if (clientList.value.length > 0 && !activeClientKey.value) {
                activeClientKey.value = `${clientList.value[0].localIp}|${clientList.value[0].localPort}|${clientList.value[0].remoteIp}|${clientList.value[0].remotePort}`;
            }
        } else {
            message.error('客户端列表获取失败');
        }
    };

    const loadClientList = async () => {
        try {
            const clientListResult = await window.bmpApi.getClientList();
            if (clientListResult.status === 'success') {
                clientList.value = clientListResult.data;

                // 设置默认选中第一个客户端
                if (clientList.value.length > 0 && !activeClientKey.value) {
                    activeClientKey.value = `${clientList.value[0].localIp}|${clientList.value[0].localPort}|${clientList.value[0].remoteIp}|${clientList.value[0].remotePort}`;
                }
            }
        } catch (error) {
            console.error(error);
            message.error('加载数据失败');
        }
    };

    // 加载对等体列表
    const loadPeerList = async clientKey => {
        if (!clientKey) return;

        try {
            const [localIp, localPort, remoteIp, remotePort] = clientKey.split('|');
            const clientInfo = {
                localIp,
                localPort,
                remoteIp,
                remotePort
            };

            const peerListResult = await window.bmpApi.getPeers(clientInfo);
            if (peerListResult.status === 'success') {
                peerList.value = peerListResult.data || [];
            } else {
                peerList.value = [];
                message.error('获取BGP邻居列表失败');
            }
        } catch (error) {
            console.error(error);
            peerList.value = [];
            message.error('获取BGP邻居列表失败');
        }
    };

    // 监听activeClientKey变化，加载对应的peer列表
    watch(activeClientKey, newKey => {
        loadPeerList(newKey);
    });

    onActivated(async () => {
        clientList.value = [];
        activeClientKey.value = '';
        peerList.value = [];
        await loadClientList();
        // 如果有选中的客户端，则加载对应的peer列表
        if (activeClientKey.value) {
            await loadPeerList(activeClientKey.value);
        }
    });

    onBeforeUnmount(() => {
        window.bmpApi.offPeerUpdate(onPeerUpdate);
        window.bmpApi.offInitiation(onClientListUpdate);
        window.bmpApi.offTermination(onTerminationHandler);
    });
</script>

<style scoped>
    :deep(.ant-table-body) {
        height: 400px !important;
        overflow-y: auto !important;
    }

    .bgp-peer-info-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding: 8px;
        background-color: #f5f5f5;
        border-radius: 4px;
    }

    .bgp-peer-info-header-text {
        margin-right: 8px;
        font-weight: 500;
    }

    .no-result-message {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        width: 100%;
        color: #999;
        overflow: auto;
    }
</style>
