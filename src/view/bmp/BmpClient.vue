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
                                    <a-tab-pane key="session" tab="session">
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
                                                            <template v-else-if="column.key === 'action'">
                                                                <a-button type="link" size="small" @click="viewSessionDetails(record)">
                                                                    详情
                                                                </a-button>
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
                                        <a-empty v-else description="Session 暂无数据" />
                                    </a-tab-pane>
                                    <a-tab-pane key="loc-rib" tab="loc-rib">
                                        <div v-if="bgpInstances.length > 0">
                                            <a-tabs v-model:active-key="activeInstanceKey">
                                                <a-tab-pane
                                                    v-for="instance in bgpInstances"
                                                    :key="`${instance.instanceType}|${instance.instanceRd}|${instance.addrFamilyType}`"
                                                    :tab="`${instance.instanceType}|${instance.instanceRd}|${ADDRESS_FAMILY_NAME[instance.addrFamilyType]}`"
                                                >

                                                    <a-table
                                                        :columns="bgpInstanceColumns"
                                                        :data-source="[instance]"
                                                        :pagination="false"
                                                        size="small"
                                                        style="margin-bottom: 8px"
                                                        row-key="peerIp"
                                                    >
                                                        <template #bodyCell="{ column, record }">
                                                            <template v-if="column.key === 'addPath'">
                                                                <a-tag v-if="record.isAddPath " color="green">Yes</a-tag>
                                                                <a-tag v-else color="red">No</a-tag>
                                                            </template>
                                                            <template v-else-if="column.key === 'action'">
                                                                <a-button type="link" size="small" @click="viewInstanceDetails(record)">
                                                                    详情
                                                                </a-button>
                                                            </template>
                                                        </template>
                                                    </a-table>
                                                    <a-table
                                                        :columns="bgpRouteColumns"
                                                        :data-source="bgpRouteList"
                                                        :pagination="bgpRoutePagination"
                                                        size="small"
                                                        :scroll="{ y: 400 }"
                                                    />
                                                </a-tab-pane>
                                            </a-tabs>
                                        </div>
                                        <a-empty v-else description="Loc-RIB 暂无数据" />
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
    import {
        BMP_SESSION_TYPE_NAME,
        BMP_SESSION_STATE_NAME,
        BMP_SESSION_STATE,
        BMP_BGP_RIB_TYPE_NAME
    } from '../../const/bmpConst';
    import { ADDRESS_FAMILY_NAME } from '../../const/bgpConst';
    defineOptions({
        name: 'BmpClient'
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

    const bgpInstanceColumns = [
        {
            title: 'Instance Type',
            dataIndex: 'instanceType',
            key: 'instanceType',
            ellipsis: true,
            width: 100,
            customRender: ({ text }) => {
                return BMP_SESSION_TYPE_NAME[text] || text;
            }
        },
        {
            title: 'Instance IP',
            dataIndex: 'instanceIp',
            key: 'instanceIp',
            width: 100,
            ellipsis: true
        },
        {
            title: 'AS',
            dataIndex: 'instanceAs',
            key: 'instanceAs',
            width: 100,
            ellipsis: true
        },
        {
            title: 'RD',
            dataIndex: 'instanceRd',
            key: 'instanceRd',
            width: 100,
            ellipsis: true
        },
        {
            title: 'Router ID',
            dataIndex: 'instanceRouterId',
            key: 'instanceRouterId',
            width: 100,
            ellipsis: true
        },
        {
            title: 'ADD-PATH',
            key: 'addPath',
            ellipsis: true,
            width: 80
        },
        {
            title: 'Instance状态',
            dataIndex: 'instanceState',
            key: 'instanceState',
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
    const viewSessionDetails = record => {
        currentDetails.value = record;
        detailsDrawerTitle.value = `Session 详情: ${record.sessionIp}`;
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
        window.bmpApi.onSessionUpdate(onSessionUpdate);

        // 监听Client列表更新事件
        // 监听Client列表更新事件
        window.bmpApi.onInitiation(onClientListUpdate);
        window.bmpApi.onTermination(onTerminationHandler);
        // 监听路由更新事件
        window.bmpApi.onRouteUpdate(onRouteUpdate);
    });

    const onRouteUpdate = result => {
        if (result.status !== 'success' || !result.data) return;
        const update = result.data;

        const clientKey = `${update.client.localIp}|${update.client.localPort}|${update.client.remoteIp}|${update.client.remotePort}`;
        if (clientKey !== activeClientKey.value) return;

        if (update.isInstanceRoute) {
            if (activeMainTab.value === 'loc-rib') {
                const instKey = `${update.instance.instanceType}|${update.instance.instanceRd}|${update.instance.addrFamilyType}`;

                if (instKey === activeInstanceKey.value) {
                    loadInstanceRoutes();
                }
            }
        } else {
            if (activeMainTab.value === 'session') {
                const sessKey = `${update.session.sessionType}|${update.session.sessionRd}|${update.session.sessionIp}|${update.session.sessionAs}`;
                if (sessKey === activeBgpSessionKey.value) {
                     if (update.af === activeLocRibAf.value && update.ribType === activeLocRibType.value) {
                         loadBgpRoutes();
                     }
                }
            }
        }
    };

    const onSessionUpdate = result => {
        if (result.status !== 'success' || !result.data) return;
        const data = result.data;

        // Check Client
        const clientKey = `${data.client.localIp}|${data.client.localPort}|${data.client.remoteIp}|${data.client.remotePort}`;
        if (clientKey !== activeClientKey.value) return;

        if (data.isInstance) {
            // Loc-RIB Instance Update
            if (activeMainTab.value === 'loc-rib') {
                loadBgpInstances();
            }
        } else {
            // Global Session Update
            if (activeMainTab.value === 'session') {
                loadBgpSessionList();
            }
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
    const loadBgpSessionList = async () => {
        if (!activeClientKey.value) return;

        try {
            const [localIp, localPort, remoteIp, remotePort] = activeClientKey.value.split('|');
            const clientInfo = {
                localIp,
                localPort,
                remoteIp,
                remotePort
            };

            const bgpSessionListResult = await window.bmpApi.getBgpSessions(clientInfo);
            if (bgpSessionListResult.status === 'success') {
                bgpSessionList.value = bgpSessionListResult.data || [];
                loadBgpRoutes();
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
    const activeMainTab = ref('session');
    const activeBgpSessionKey = ref('');
    const activeLocRibAf = ref(null);
    const activeLocRibType = ref('');
    const bgpRouteList = ref([]);

    // Instance Logic
    const bgpInstances = ref([]);
    const activeInstanceKey = ref('');

    const loadBgpInstances = async () => {
        if (!activeClientKey.value) return;
        try {
            const [localIp, localPort, remoteIp, remotePort] = activeClientKey.value.split('|');
            const clientInfo = { localIp, localPort, remoteIp, remotePort };
            const res = await window.bmpApi.getBgpInstances(clientInfo);
            if (res.status === 'success') {
                bgpInstances.value = res.data || [];
                if (bgpInstances.value.length > 0) {
                    const first = bgpInstances.value[0];
                    const key = `${first.instanceType}|${first.instanceRd}|${first.addrFamilyType}`;
                    activeInstanceKey.value = key;
                    loadInstanceRoutes();
                } else {
                    bgpRouteList.value = [];
                    activeInstanceKey.value = '';
                }
            } else {
                bgpInstances.value = [];
                activeInstanceKey.value = '';
            }
        } catch (error) {
            console.error(error);
            bgpInstances.value = [];
            message.error('Load BMP instances failed');
        }
    };

    const loadInstanceRoutes = async () => {
        if (!activeClientKey.value) return;

        const [localIp, localPort, remoteIp, remotePort] = activeClientKey.value.split('|');
        const client = { localIp, localPort, remoteIp, remotePort };

        const instance = {
            instanceType: activeInstanceKey.value.split('|')[0],
            instanceRd: activeInstanceKey.value.split('|')[1],
            addrFamilyType: activeInstanceKey.value.split('|')[2],
        };

        const page = bgpRoutePagination.value.current;
        const pageSize = bgpRoutePagination.value.pageSize;

        try {
            const res = await window.bmpApi.getBgpInstanceRoutes(client, instance, page, pageSize);
            if (res.status === 'success' && res.data) {
                bgpRouteList.value = res.data.list;
                bgpRoutePagination.value.total = res.data.total;
            } else {
                bgpRouteList.value = [];
                bgpRoutePagination.value.total = 0;
            }
        } catch (e) {
            console.error(e);
            message.error('Load instance routes failed');
        }
    };

    const viewInstanceDetails = record => {
        currentDetails.value = record;
        detailsDrawerTitle.value = `Instance 详情: ${record.instanceRd}`;
        detailsDrawerVisible.value = true;
    };

    // 监听activeClientKey变化，加载对应的peer列表 AND instances
    watch(activeClientKey, newKey => {
        loadBgpSessionList();
        bgpInstances.value = [];
        bgpRouteList.value = [];
        if (activeMainTab.value === 'loc-rib') {
            loadBgpInstances(newKey);
        }
    });

    watch(activeMainTab, newTab => {
        if (newTab === 'session') {
            loadBgpSessionList();
        }
        if (newTab === 'loc-rib') {
            loadBgpInstances();
        }
    });

    onActivated(async () => {
        clientList.value = [];
        activeClientKey.value = '';
        bgpSessionList.value = [];
        bgpInstances.value = [];
        await loadClientList();
        // 如果有选中的客户端，则加载对应的BGP会话列表
        if (activeClientKey.value) {
            await loadBgpSessionList();
            if (activeMainTab.value === 'loc-rib') {
                await loadBgpInstances();
            }
        }
    });

    onBeforeUnmount(() => {
        window.bmpApi.offPeerUpdate(onSessionUpdate);
        window.bmpApi.offInitiation(onClientListUpdate);
        window.bmpApi.offTermination(onTerminationHandler);
        window.bmpApi.offRouteUpdate(onRouteUpdate);
    });

    const groupedBgpSessions = computed(() => {
        return bgpSessionList.value.map(p => {
            const key = `${p.sessionType}|${p.sessionRd}|${p.sessionIp}|${p.sessionAs}`;

            return {
                key,
                sessionType: p.sessionType,
                sessionRd: p.sessionRd,
                sessionIp: p.sessionIp,
                sessionAs: p.sessionAs,
                afs: p.enabledAddrFamilyTypes || [],
                ribTypes: p.ribTypes,
                sessionInfo: p
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
            if (activeMainTab.value === 'loc-rib') {
                loadInstanceRoutes();
            } else {
                loadBgpRoutes();
            }
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

    watch(activeInstanceKey, newKey => {
        if (newKey) {
            bgpRoutePagination.value.current = 1;
            loadInstanceRoutes();
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
