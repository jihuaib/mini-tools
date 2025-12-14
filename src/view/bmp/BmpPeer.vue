<template>
    <div class="mt-container">
        <a-row>
            <a-col :span="24">
                <a-card title="BMP Client">
                    <div v-if="clientList.length > 0">
                        <a-tabs v-model:active-key="activeClientKey">
                            <a-tab-pane
                                v-for="client in clientList"
                                :key="`${client.localIp}|${client.localPort}|${client.remoteIp}|${client.remotePort}`"
                                :tab="`${client.sysDesc}[${client.remoteIp}]`"
                            >
                                <a-tabs tab-position="left" v-model:active-key="activeMainTab">
                                    <a-tab-pane key="peer" tab="peer">
                                        <div v-if="groupedBgpSessions.length > 0">
                                            <a-tabs v-model:active-key="activeBgpSessionKey">
                                                <a-tab-pane
                                                    v-for="group in groupedBgpSessions"
                                                    :key="group.key"
                                                    :tab="`${group.sessionType} | rd(${group.sessionRd}) | ip(${group.sessionIp}) | as(${group.sessionAs})`"
                                                >
                                                    <a-table
                                                        :columns="bgpSessionColumns"
                                                        :data-source="[group.sessionInfo]"
                                                        :pagination="false"
                                                        size="small"
                                                        style="margin-bottom: 8px"
                                                        row-key="peerIp"
                                                    >
                                                        <template #bodyCell="{ column, record }">
                                                            <template v-if="column.key === 'addPathMap'">
                                                                <a-tooltip
                                                                    v-if="
                                                                        record.addPathMap &&
                                                                        Object.values(record.addPathMap).some(v => v)
                                                                    "
                                                                >
                                                                    <template #title>
                                                                        <div
                                                                            v-for="(enabled, key) in record.addPathMap"
                                                                            :key="key"
                                                                        >
                                                                            <span v-if="enabled">
                                                                                {{ ADDRESS_FAMILY_NAME[key] }}: Yes
                                                                            </span>
                                                                        </div>
                                                                    </template>
                                                                    <a-tag color="green">Yes</a-tag>
                                                                </a-tooltip>
                                                                <a-tag v-else color="red">No</a-tag>
                                                            </template>
                                                        </template>
                                                    </a-table>
                                                    <div
                                                        style="
                                                            margin-bottom: 8px;
                                                            display: flex;
                                                            gap: 16px;
                                                            align-items: center;
                                                        "
                                                    >
                                                        <a-select v-model:value="activeLocRibAf" style="width: 200px">
                                                            <a-select-option
                                                                v-for="af in group.afs"
                                                                :key="af"
                                                                :value="af"
                                                            >
                                                                {{ ADDRESS_FAMILY_NAME[af] || af }}
                                                            </a-select-option>
                                                        </a-select>
                                                        <a-select v-model:value="activeLocRibType" style="width: 200px">
                                                            <a-select-option
                                                                v-for="rt in group.ribTypes"
                                                                :key="rt"
                                                                :value="rt"
                                                            >
                                                                {{ BMP_BGP_RIB_TYPE_NAME[rt] }}
                                                            </a-select-option>
                                                        </a-select>
                                                        <a-button type="primary" @click="loadBgpRoutes">查询</a-button>
                                                    </div>
                                                    <a-table
                                                        :columns="bgpRouteColumns"
                                                        :data-source="bgpRouteList"
                                                        :pagination="bgpRoutePagination"
                                                        :row-key="
                                                            record =>
                                                                `${record.addrFamilyType}|${record.rd}|${record.ip}|${record.mask}`
                                                        "
                                                        size="small"
                                                        :scroll="{ y: 400 }"
                                                    />
                                                </a-tab-pane>
                                            </a-tabs>
                                        </div>
                                    </a-tab-pane>
                                    <a-tab-pane key="loc-rib" tab="loc-rib">
                                        <div v-if="bmpInstances.length > 0">
                                            <a-tabs v-model:active-key="activeInstanceKey">
                                                <a-tab-pane
                                                    v-for="instance in bmpInstances"
                                                    :key="`${instance.instanceType}|${instance.instanceRd}|${instance.enabledAddrFamilyTypes[0]}`"
                                                    :tab="`${instance.instanceType} | rd(${instance.instanceRd}) | ${ADDRESS_FAMILY_NAME[instance.enabledAddrFamilyTypes[0]]}`"
                                                >
                                                    <a-descriptions bordered size="small" :column="2">
                                                        <a-descriptions-item label="Instance Type">
                                                            {{ instance.instanceType }}
                                                        </a-descriptions-item>
                                                        <a-descriptions-item label="RD">
                                                            {{ instance.instanceRd }}
                                                        </a-descriptions-item>
                                                        <a-descriptions-item label="Peer IP">
                                                            {{ instance.instanceIp }}
                                                        </a-descriptions-item>
                                                        <a-descriptions-item label="Peer AS">
                                                            {{ instance.instanceAs }}
                                                        </a-descriptions-item>
                                                        <a-descriptions-item label="Local IP">
                                                            {{ instance.localIp }}
                                                        </a-descriptions-item>
                                                        <a-descriptions-item label="Router ID">
                                                            {{ instance.instanceRouterId }}
                                                        </a-descriptions-item>
                                                    </a-descriptions>
                                                    <a-table
                                                        :columns="bgpRouteColumns"
                                                        :data-source="bgpRouteList"
                                                        :pagination="bgpRoutePagination"
                                                        :row-key="
                                                            record =>
                                                                `${record.addrFamilyType}|${record.rd}|${record.ip}|${record.mask}`
                                                        "
                                                        size="small"
                                                        :scroll="{ y: 400 }"
                                                    />
                                                </a-tab-pane>
                                            </a-tabs>
                                        </div>
                                    </a-tab-pane>
                                    <a-tab-pane key="route-statis" tab="route-statis">
                                        <a-empty description="Route Statistics 暂无数据" />
                                    </a-tab-pane>
                                </a-tabs>
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
    import { ref, onMounted, onActivated, watch, onBeforeUnmount, computed } from 'vue';
    import { message } from 'ant-design-vue';
    import { useRouter } from 'vue-router';
    import {
        BMP_SESSION_TYPE_NAME,
        BMP_SESSION_FLAGS_NAME,
        BMP_SESSION_STATE_NAME,
        BMP_SESSION_STATE,
        BMP_BGP_RIB_TYPE_NAME
    } from '../../const/bmpConst';
    import { ADDRESS_FAMILY_NAME } from '../../const/bgpConst';
    defineOptions({
        name: 'BmpPeer'
    });

    // 客户端
    const clientList = ref([]);
    const activeClientKey = ref('');

    const bgpSessionList = ref([]);

    // 对等体列表
    const bgpSessionColumns = [
        {
            title: 'Session Type',
            dataIndex: 'sessionType',
            key: 'sessionType',
            ellipsis: true,
            width: 100,
            customRender: ({ text }) => {
                return BMP_SESSION_TYPE_NAME[text] || text;
            }
        },
        {
            title: 'Session IP',
            dataIndex: 'sessionIp',
            key: 'sessionIp',
            width: 100,
            ellipsis: true
        },
        {
            title: 'AS',
            dataIndex: 'sessionAs',
            key: 'sessionAs',
            width: 100,
            ellipsis: true
        },
        {
            title: 'RD',
            dataIndex: 'sessionRd',
            key: 'sessionRd',
            width: 100,
            ellipsis: true
        },
        {
            title: 'Router ID',
            dataIndex: 'sessionRouterId',
            key: 'sessionRouterId',
            width: 100,
            ellipsis: true
        },
        {
            title: 'Session Flags',
            dataIndex: 'sessionFlags',
            key: 'sessionFlags',
            ellipsis: true,
            width: 80,
            customRender: ({ text }) => {
                return Object.keys(BMP_SESSION_FLAGS_NAME)
                    .filter(key => text & key)
                    .map(key => BMP_SESSION_FLAGS_NAME[key])
                    .join(', ');
            }
        },
        {
            title: 'ADD-PATH',
            dataIndex: 'addPathMap',
            key: 'addPathMap',
            ellipsis: true,
            width: 80
        },
        {
            title: 'Session状态',
            dataIndex: 'sessionState',
            key: 'sessionState',
            ellipsis: true,
            width: 100,
            customRender: ({ text }) => {
                return BMP_SESSION_STATE_NAME[text] || text;
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
                bgpSessionList.value = [];
            }

            if (clientList.value.length === 0) {
                activeClientKey.value = '';
                bgpSessionList.value = [];
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
            const existingIndex = bgpSessionList.value.findIndex(
                peer => `${peer.addrFamilyType}|${peer.peerIp}|${peer.peerRd}` === peerKey
            );

            if (existingIndex !== -1) {
                // 更新现有记录
                if (peerData.peerState === BMP_SESSION_STATE.PEER_UP) {
                    bgpSessionList.value[existingIndex] = peerData;
                } else {
                    bgpSessionList.value.splice(existingIndex, 1);
                }
            } else {
                // 使用展开运算符创建新数组以确保响应式更新
                if (bgpSessionList.value.length === 0) {
                    // 首次添加，直接赋值一个新数组以确保触发响应式更新
                    bgpSessionList.value = [peerData];
                } else {
                    bgpSessionList.value = [...bgpSessionList.value, peerData];
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

    // 加载BGP会话列表
    const loadBgpSessionList = async clientKey => {
        if (!clientKey) return;

        try {
            const [localIp, localPort, remoteIp, remotePort] = clientKey.split('|');
            const clientInfo = {
                localIp,
                localPort,
                remoteIp,
                remotePort
            };

            const bgpSessionListResult = await window.bmpApi.getBgpSessions(clientInfo);
            if (bgpSessionListResult.status === 'success') {
                bgpSessionList.value = bgpSessionListResult.data || [];
            } else {
                bgpSessionList.value = [];
                message.error('获取BGP邻居列表失败');
            }
        } catch (error) {
            console.error(error);
            bgpSessionList.value = [];
            message.error('获取BGP邻居列表失败');
        }
    };

    // Loc-RIB Logic
    const activeMainTab = ref('peer');
    const activeBgpSessionKey = ref('');
    const activeLocRibAf = ref(null);
    const activeLocRibType = ref('');
    const bgpRouteList = ref([]);

    // Instance Logic
    const bmpInstances = ref([]);
    const activeInstanceKey = ref('');

    const loadBmpInstances = async clientKey => {
        if (!clientKey) return;
        try {
            const [localIp, localPort, remoteIp, remotePort] = clientKey.split('|');
            const clientInfo = { localIp, localPort, remoteIp, remotePort };
            const res = await window.bmpApi.getBmpInstances(clientInfo);
            if (res.status === 'success') {
                bmpInstances.value = res.data || [];
                if (bmpInstances.value.length > 0) {
                    activeInstanceKey.value = `${bmpInstances.value[0].instanceType}|${bmpInstances.value[0].instanceRd}|${bmpInstances.value[0].enabledAddrFamilyTypes[0]}`;
                }
            } else {
                bmpInstances.value = [];
            }
        } catch (error) {
            console.error(error);
            bmpInstances.value = [];
            message.error('Load BMP instances failed');
        }
    };

    // 监听activeClientKey变化，加载对应的peer列表 AND instances
    watch(activeClientKey, newKey => {
        loadBgpSessionList(newKey);
        // Clear instances/routes when client changes
        bmpInstances.value = [];
        bgpRouteList.value = [];
        // Only load instances if on loc-rib tab
        if (activeMainTab.value === 'loc-rib') {
            loadBmpInstances(newKey);
        }
    });

    watch(activeMainTab, newTab => {
        if (newTab === 'loc-rib' && activeClientKey.value) {
            // Lazy load instances
            if (bmpInstances.value.length === 0) {
                 loadBmpInstances(activeClientKey.value);
            }
        }
    });

    onActivated(async () => {
        clientList.value = [];
        activeClientKey.value = '';
        bgpSessionList.value = [];
        bmpInstances.value = [];
        await loadClientList();
        // 如果有选中的客户端，则加载对应的BGP会话列表
        if (activeClientKey.value) {
            await loadBgpSessionList(activeClientKey.value);
            if (activeMainTab.value === 'loc-rib') {
                await loadBmpInstances(activeClientKey.value);
            }
        }
    });

    onBeforeUnmount(() => {
        window.bmpApi.offPeerUpdate(onPeerUpdate);
        window.bmpApi.offInitiation(onClientListUpdate);
        window.bmpApi.offTermination(onTerminationHandler);
    });

    const groupedBgpSessions = computed(() => {
        console.log(bgpSessionList.value);
        return bgpSessionList.value.map(p => {
            const key = `${p.sessionType}|${p.sessionRd}|${p.sessionIp}|${p.sessionAs}`;

            let sessionInfo = {
                sessionType: p.sessionType,
                sessionRd: p.sessionRd,
                sessionIp: p.sessionIp,
                sessionAs: p.sessionAs,
                addPathMap: p.addPathMap
            };

            return {
                key,
                sessionType: p.sessionType,
                sessionRd: p.sessionRd,
                sessionIp: p.sessionIp,
                sessionAs: p.sessionAs,
                afs: p.enabledAddrFamilyTypes || [],
                ribTypes: p.ribTypes,
                sessionInfo: sessionInfo
            };
        });
    });

    const bgpRoutePagination = ref({
        current: 1,
        pageSize: 10,
        total: 0,
        showSizeChanger: false,
        position: ['bottomCenter'],
        onChange: (page, pageSize) => {
            bgpRoutePagination.value.current = page;
            bgpRoutePagination.value.pageSize = pageSize;
            loadBgpRoutes();
        }
    });

    const bgpRouteColumns = [
        {
            title: 'Addr Family',
            dataIndex: 'addrFamilyType',
            key: 'addrFamilyType',
            ellipsis: true,
            width: 100,
            customRender: ({ text }) => ADDRESS_FAMILY_NAME[text] || text
        },
        { title: 'Path ID', dataIndex: 'pathId', key: 'pathId', ellipsis: true, width: 100 },
        { title: 'RD', dataIndex: 'rd', key: 'rd', ellipsis: true, width: 100 },
        { title: 'Prefix', dataIndex: 'ip', key: 'ip', ellipsis: true, width: 120 },
        { title: 'Mask', dataIndex: 'mask', key: 'mask', ellipsis: true, width: 60 },
        { title: 'Origin', dataIndex: 'origin', key: 'origin', ellipsis: true, width: 80 },
        { title: 'AS Path', dataIndex: 'asPath', key: 'asPath', ellipsis: true },
        { title: 'Next Hop', dataIndex: 'nextHop', key: 'nextHop', ellipsis: true, width: 120 },
        { title: 'MED', dataIndex: 'med', key: 'med', ellipsis: true, width: 80 }
    ];

    const loadBgpRoutes = async () => {
        if (!activeClientKey.value || !activeBgpSessionKey.value || !activeLocRibAf.value || !activeLocRibType.value)
            return;
        const [localIp, localPort, remoteIp, remotePort] = activeClientKey.value.split('|');
        const [sessionType, sessionRd, sessionIp, sessionAs] = activeBgpSessionKey.value.split('|');

        const client = { localIp, localPort, remoteIp, remotePort };
        const sessionInfo = { sessionType, sessionRd, sessionIp, sessionAs };
        const af = activeLocRibAf.value;
        const ribType = activeLocRibType.value;
        const page = bgpRoutePagination.value.current;
        const pageSize = bgpRoutePagination.value.pageSize;

        try {
            const res = await window.bmpApi.getBgpRoutes(client, sessionInfo, af, ribType, page, pageSize);
            if (res.status === 'success' && res.data) {
                bgpRouteList.value = res.data.list;
                bgpRoutePagination.value.total = res.data.total;
            } else {
                bgpRouteList.value = [];
                bgpRoutePagination.value.total = 0;
            }
        } catch (e) {
            console.error(e);
            message.error('Load routes failed');
        }
    };

    watch(groupedBgpSessions, newVal => {
        console.log(newVal);
        if (newVal.length > 0 && !activeBgpSessionKey.value) {
            activeBgpSessionKey.value = newVal[0].key;
            if (newVal[0].afs.length > 0) activeLocRibAf.value = newVal[0].afs[0];
            if (newVal[0].ribTypes.length > 0) activeLocRibType.value = newVal[0].ribTypes[0].value;
            loadBgpRoutes();
        }
    });

    watch(activeBgpSessionKey, newKey => {
        if (newKey) {
            const group = groupedBgpSessions.value.find(g => g.key === newKey);
            if (group) {
                if (!activeLocRibAf.value || !group.afs.includes(activeLocRibAf.value)) {
                    activeLocRibAf.value = group.afs[0];
                }
                if (!activeLocRibType.value || !group.ribTypes.includes(activeLocRibType.value)) {
                    activeLocRibType.value = group.ribTypes[0];
                }
                bgpRoutePagination.value.current = 1;
                loadBgpRoutes();
            }
        }
    });

    watch([activeLocRibAf, activeLocRibType], () => {
        if (activeBgpSessionKey.value) {
            bgpRoutePagination.value.current = 1;
            loadBgpRoutes();
        }
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
