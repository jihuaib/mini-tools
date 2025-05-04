<template>
    <div class="bmp-peer-route-container">
        <a-card :title="`BGP路由 - ${peerName}`">
            <a-row class="route-filters">
                <a-col :span="8">
                    <a-input-search
                        v-model:value="searchText"
                        placeholder="搜索前缀"
                        style="width: 100%"
                        @search="onSearch"
                    />
                </a-col>
                <a-col :span="6">
                    <a-select
                        v-model:value="addrFamilyFilter"
                        placeholder="地址族"
                        style="width: 100%"
                        allow-clear
                        @change="onFilterChange"
                    >
                        <a-select-option v-for="(name, value) in ADDRESS_FAMILY_NAME" :key="value" :value="value">
                            {{ name }}
                        </a-select-option>
                    </a-select>
                </a-col>
                <a-col :span="10" class="route-stats">
                    <a-tag color="blue">总路由数: {{ filteredRouteList.length }}</a-tag>
                </a-col>
            </a-row>

            <a-table
                :columns="routeColumns"
                :data-source="filteredRouteList"
                :rowKey="record => `${record.addrFamilyType}|${record.ip}|${record.mask}`"
                :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
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
    import { ref, onMounted, computed, watch, onActivated } from 'vue';
    import { message } from 'ant-design-vue';
    import { useRoute } from 'vue-router';
    import { ADDRESS_FAMILY_NAME } from '../../const/bgpConst';
    import { BMP_ROUTE_UPDATE_TYPE } from '../../const/bmpConst';

    defineOptions({
        name: 'BmpPeerRoute'
    });

    const route = useRoute();
    const clientId = ref(route.params.clientId);
    const peerId = ref(route.params.peerId);
    const peerName = ref('');
    const routeList = ref([]);
    const searchText = ref('');
    const addrFamilyFilter = ref(null);
    const clientInfo = ref(null);
    const peerInfo = ref(null);

    // Computed filtered routes
    const filteredRouteList = computed(() => {
        let filtered = [...routeList.value];

        // Apply address family filter
        if (addrFamilyFilter.value) {
            filtered = filtered.filter(route => route.addrFamilyType == addrFamilyFilter.value);
        }

        // Apply search filter
        if (searchText.value) {
            const search = searchText.value.toLowerCase();
            filtered = filtered.filter(
                route =>
                    route.ip.toLowerCase().includes(search) ||
                    route.mask.toString().includes(search) ||
                    (route.asPath && route.asPath.toLowerCase().includes(search)) ||
                    (route.nextHop && route.nextHop.toLowerCase().includes(search))
            );
        }

        return filtered;
    });

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

    // Search and filter handlers
    const onSearch = () => {
        // Search is handled by the computed property
    };

    const onFilterChange = () => {
        // Filter is handled by the computed property
    };

    onMounted(async () => {
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

            console.log('client', client);
            console.log('peer', peer);

            const clientResult = await window.bmpApi.getClient(client);
            const peerResult = await window.bmpApi.getPeer(client, peer);

            console.log('clientInfo', clientResult);
            console.log('peerInfo', peerResult);

            if (clientResult.status === 'success' && peerResult.status === 'success') {
                clientInfo.value = clientResult.data;
                peerInfo.value = peerResult.data;
                peerName.value = `${peerResult.data.peerIp} (AS${peerResult.data.peerAs})`;
            } else {
                peerName.value = peerId.value;
            }
        } catch (error) {
            console.error('获取对等体信息失败', error);
            message.error('获取对等体信息失败');
            peerName.value = peerId.value || 'Unknown Peer';
        }

        loadPeerRoutes();
        window.bmpApi.onRouteUpdate(onRouteUpdate);
    });

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
            const result = await window.bmpApi.getRoutes(client, peer);
            if (result.status === 'success') {
                routeList.value = result.data;
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
            const routeData = result.data;
            const opType = routeData.type;
            const updateClient = routeData.client;
            const updatePeer = routeData.peer;
            const updateRoute = routeData.route;

            const currentPeerId = decodeURIComponent(peerId.value);
            const currentClientId = decodeURIComponent(clientId.value);

            const updatePeerId = `${updatePeer.addrFamilyType}|${updatePeer.peerIp}|${updatePeer.peerRd}`;
            const updateClientId = `${updateClient.localIp}|${updateClient.localPort}|${updateClient.remoteIp}|${updateClient.remotePort}`;

            if (currentPeerId !== updatePeerId || currentClientId !== updateClientId) {
                return;
            }

            if (opType === BMP_ROUTE_UPDATE_TYPE.ROUTE_DELETE) {
                const routeKey = `${updateRoute.addrFamilyType}|${updateRoute.ip}|${updateRoute.mask}`;
                const existingIndex = routeList.value.findIndex(
                    route => `${route.addrFamilyType}|${route.ip}|${route.mask}` === routeKey
                );
                if (existingIndex !== -1) {
                    routeList.value.splice(existingIndex, 1);
                }
            } else if (opType === BMP_ROUTE_UPDATE_TYPE.ROUTE_UPDATE) {
                const routeKey = `${updateRoute.addrFamilyType}|${updateRoute.ip}|${updateRoute.mask}`;
                const existingIndex = routeList.value.findIndex(
                    route => `${route.addrFamilyType}|${route.ip}|${route.mask}` === routeKey
                );
                if (existingIndex !== -1) {
                    routeList.value[existingIndex] = updateRoute;
                } else {
                    routeList.value.push(updateRoute);
                }
            }
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
                loadPeerRoutes();
            }
        }
    );
</script>

<style scoped>
    .bmp-peer-route-container {
        margin-top: 10px;
        margin-left: 8px;
    }

    .route-filters {
        margin-bottom: 16px;
    }

    .route-stats {
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }

    :deep(.ant-card-body) {
        padding: 10px;
    }

    :deep(.ant-card-head) {
        padding: 0 10px;
        min-height: 40px;
    }

    :deep(.ant-card-head-title) {
        padding: 10px 0;
    }

    :deep(.ant-table-tbody > tr > td) {
        height: 30px;
        padding-top: 8px;
        padding-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    :deep(.ant-table-body) {
        height: 300px !important;
        overflow-y: auto !important;
    }

    :deep(.ant-table-cell) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* 表格样式调整 */
    :deep(.ant-table-small) {
        font-size: 12px;
    }
</style>
