<template>
    <div class="mt-container">
        <a-card :title="`BGP路由 - ${peerName}`">
            <a-tabs v-model:active-key="activeRibType" @change="onRibTypeChange">
                <a-tab-pane key="preRibIn" tab="Pre-RIB-In" />
                <a-tab-pane key="ribIn" tab="RIB-In" />
                <a-tab-pane key="locRib" tab="Loc-Rib" />
                <a-tab-pane key="postLocRib" tab="Post-Loc-RIB" />
            </a-tabs>

            <div class="route-list-header">
                <UnorderedListOutlined />
                <span class="header-text">已接受路由列表</span>
                <a-tag v-if="pagination.total > 0" color="blue">
                    {{ pagination.total }}
                </a-tag>
            </div>

            <a-table
                :columns="routeColumns"
                :data-source="routeList"
                :row-key="record => `${record.addrFamilyType}|${record.rd}|${record.ip}|${record.mask}`"
                :pagination="pagination"
                :scroll="{ y: 400 }"
                size="small"
            >
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'action'">
                        <a-button type="link" @click="viewRouteDetails(record)">详情</a-button>
                    </template>
                </template>
            </a-table>
        </a-card>

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
    import { ref, onMounted, watch, onActivated, onBeforeUnmount } from 'vue';
    import { message } from 'ant-design-vue';
    import { useRoute } from 'vue-router';
    import { ADDRESS_FAMILY_NAME } from '../../const/bgpConst';
    import { BMP_ROUTE_UPDATE_TYPE } from '../../const/bmpConst';
    import { UnorderedListOutlined } from '@ant-design/icons-vue';

    defineOptions({
        name: 'BmpPeerRoute'
    });

    const route = useRoute();
    const clientId = ref(route.params.clientId);
    const peerId = ref(route.params.peerId);
    const peerName = ref('');
    const routeList = ref([]);
    const clientInfo = ref(null);
    const peerInfo = ref(null);
    const activeRibType = ref('preRibIn');

    // Route table columns
    const routeColumns = [
        {
            title: '地址族',
            dataIndex: 'addrFamilyType',
            key: 'addrFamilyType',
            ellipsis: true,
            customRender: ({ text }) => {
                return ADDRESS_FAMILY_NAME[text] || text;
            }
        },
        {
            title: 'RD',
            dataIndex: 'rd',
            key: 'rd',
            ellipsis: true
        },
        {
            title: 'Prefix',
            dataIndex: 'ip',
            key: 'ip',
            ellipsis: true
        },
        {
            title: 'Mask',
            dataIndex: 'mask',
            key: 'mask',
            ellipsis: true
        },
        {
            title: 'Origin',
            dataIndex: 'origin',
            key: 'origin',
            ellipsis: true
        },
        {
            title: 'AS Path',
            dataIndex: 'asPath',
            key: 'asPath',
            ellipsis: true
        },
        {
            title: 'Next Hop',
            dataIndex: 'nextHop',
            key: 'nextHop',
            ellipsis: true
        },
        {
            title: 'MED',
            dataIndex: 'med',
            key: 'med',
            ellipsis: true
        },
        {
            title: '操作',
            key: 'action'
        }
    ];

    const pagination = ref({
        current: 1,
        pageSize: 10,
        total: 0,
        showSizeChanger: false,
        position: ['bottomCenter'],
        showTotal: total => `共 ${total} 条`,
        onChange: (page, pageSize) => {
            pagination.value.current = page;
            pagination.value.pageSize = pageSize;
            loadPeerRoutes();
        }
    });

    // Drawer for route details
    const detailsDrawerVisible = ref(false);
    const detailsDrawerTitle = ref('');
    const currentDetails = ref(null);

    const viewRouteDetails = record => {
        currentDetails.value = record;
        detailsDrawerTitle.value = `Route 详情: ${record.ip}/${record.mask}`;
        detailsDrawerVisible.value = true;
    };

    const closeDetailsDrawer = () => {
        detailsDrawerVisible.value = false;
        currentDetails.value = null;
    };

    const onRibTypeChange = newRibType => {
        activeRibType.value = newRibType;
        pagination.value.current = 1;
        loadPeerRoutes();
    };

    onMounted(async () => {
        loadClientAndPeer();
        loadPeerRoutes();
        window.bmpApi.onRouteUpdate(onRouteUpdate);
        window.bmpApi.onTermination(onTerminationHandler);
    });

    // 处理BMP服务终止事件
    const onTerminationHandler = result => {
        if (result.data === null) {
            // 清空路由数据
            routeList.value = [];
        }
    };

    const loadClientAndPeer = async () => {
        try {
            if (!clientId.value || !peerId.value) {
                console.log('Missing clientId or peerId, skipping peer info loading');
                peerName.value = 'Unknown Peer';
                return;
            }

            const tempClientId = decodeURIComponent(clientId.value);
            const tempPeerId = decodeURIComponent(peerId.value);
            const clientIdArray = tempClientId.split('|');
            const peerIdArray = tempPeerId.split('|');

            if (clientIdArray.length < 4 || peerIdArray.length < 3) {
                console.log('Invalid clientId or peerId format');
                peerName.value = 'Invalid Peer ID';
                return;
            }

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

            const clientResult = await window.bmpApi.getClient(client);
            const peerResult = await window.bmpApi.getPeer(client, peer);

            if (clientResult.status === 'success' && peerResult.status === 'success') {
                clientInfo.value = clientResult.data;
                peerInfo.value = peerResult.data;
                peerName.value = `[${ADDRESS_FAMILY_NAME[peerResult.data.addrFamilyType]}]${peerResult.data.peerIp} (AS ${peerResult.data.peerAs})`;
            } else {
                peerName.value = peerId.value;
            }
        } catch (error) {
            console.error('获取对等体信息失败', error);
            message.error('获取对等体信息失败');
            peerName.value = peerId.value || 'Unknown Peer';
        }
    };

    const loadPeerRoutes = async () => {
        try {
            if (!clientId.value || !peerId.value) {
                console.log('Missing clientId or peerId, skipping route loading');
                return;
            }

            const tempClientId = decodeURIComponent(clientId.value);
            const tempPeerId = decodeURIComponent(peerId.value);
            const clientIdArray = tempClientId.split('|');
            const peerIdArray = tempPeerId.split('|');

            if (clientIdArray.length < 4 || peerIdArray.length < 3) {
                console.log('Invalid clientId or peerId format');
                return;
            }

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
            const result = await window.bmpApi.getRoutes(
                client,
                peer,
                activeRibType.value,
                pagination.value.current,
                pagination.value.pageSize
            );
            if (result.status === 'success' && result.data) {
                routeList.value = result.data.list;
                pagination.value.total = result.data.total;
            } else {
                message.error('获取BGP路由列表失败');
            }
        } catch (error) {
            console.error('获取BGP路由列表失败', error);
            message.error('获取BGP路由列表失败');
        }
    };

    const onRouteUpdate = result => {
        if (result.status === 'success') {
            const routeDataArray = result.data;
            routeDataArray.forEach(routeData => {
                const opType = routeData.type;
                const updateClient = routeData.client;
                const updatePeer = routeData.peer;
                const updateRoute = routeData.route;
                const updateRibType = routeData.ribType;

                const currentPeerId = decodeURIComponent(peerId.value);
                const currentClientId = decodeURIComponent(clientId.value);

                const updatePeerId = `${updatePeer.addrFamilyType}|${updatePeer.peerIp}|${updatePeer.peerRd}`;
                const updateClientId = `${updateClient.localIp}|${updateClient.localPort}|${updateClient.remoteIp}|${updateClient.remotePort}`;

                if (currentPeerId !== updatePeerId || currentClientId !== updateClientId) {
                    return;
                }

                if (updateRibType !== activeRibType.value) {
                    return;
                }

                if (opType === BMP_ROUTE_UPDATE_TYPE.ROUTE_DELETE) {
                    const routeKey = `${updateRoute.addrFamilyType}|${updateRoute.rd}|${updateRoute.ip}|${updateRoute.mask}`;
                    const existingIndex = routeList.value.findIndex(
                        route => `${route.addrFamilyType}|${updateRoute.rd}|${route.ip}|${route.mask}` === routeKey
                    );
                    if (existingIndex !== -1) {
                        routeList.value.splice(existingIndex, 1);
                    }
                } else if (opType === BMP_ROUTE_UPDATE_TYPE.ROUTE_UPDATE) {
                    const routeKey = `${updateRoute.addrFamilyType}|${updateRoute.rd}|${updateRoute.ip}|${updateRoute.mask}`;
                    const existingIndex = routeList.value.findIndex(
                        route => `${route.addrFamilyType}|${updateRoute.rd}|${route.ip}|${route.mask}` === routeKey
                    );
                    if (existingIndex !== -1) {
                        routeList.value[existingIndex] = updateRoute;
                    } else {
                        routeList.value.push(updateRoute);
                    }
                }
            });
        } else {
            console.error('route update handler error', result.msg);
        }
    };

    onActivated(() => {
        if (clientId.value && peerId.value) {
            loadPeerRoutes();
        } else {
            console.log('Missing clientId or peerId in onActivated, skipping route loading');
        }
    });

    watch(
        () => [route.params.clientId, route.params.peerId],
        ([newClientId, newPeerId]) => {
            if (!newClientId || !newPeerId) {
                // Skip loading if either parameter is missing
                return;
            }

            if (newClientId !== clientId.value || newPeerId !== peerId.value) {
                clientId.value = newClientId;
                peerId.value = newPeerId;
                loadClientAndPeer();
                loadPeerRoutes();
            }
        }
    );

    onBeforeUnmount(() => {
        window.bmpApi.offRouteUpdate(onRouteUpdate);
        window.bmpApi.offTermination(onTerminationHandler);
    });
</script>

<style scoped>
    .route-list-section {
        margin-top: 24px;
        border-top: 1px solid #f0f0f0;
        padding-top: 16px;
    }

    .route-list-header {
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.85);
    }

    :deep(.ant-table-body) {
        height: 300px !important;
        overflow-y: auto !important;
    }
</style>
