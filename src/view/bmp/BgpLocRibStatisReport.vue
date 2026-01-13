<template>
    <div class="mt-container">
        <a-row>
            <a-col :span="24">
                <a-card title="BGP LocRib统计">
                    <div v-if="clientList.length > 0">
                        <a-tabs v-model:active-key="activeClientKey" tab-position="left">
                            <a-tab-pane
                                v-for="client in clientList"
                                :key="`${client.localIp}|${client.localPort}|${client.remoteIp}|${client.remotePort}`"
                                :tab="`${client.sysDesc}[${client.remoteIp}]`"
                            >
                                <div v-if="getClientStatistics(client).length > 0">
                                    <a-table
                                        :columns="columns"
                                        :data-source="getClientStatistics(client)"
                                        :pagination="false"
                                        size="small"
                                        bordered
                                    >
                                        <template #bodyCell="{ column, record }">
                                            <template v-if="column.key === 'typeName'">
                                                {{ record.typeName }}
                                            </template>
                                            <template v-if="column.key === 'value'">
                                                {{ record.value }}
                                            </template>
                                        </template>
                                    </a-table>
                                </div>
                                <div v-else class="no-result-message">
                                    <a-empty description="暂无统计数据" />
                                </div>
                            </a-tab-pane>
                        </a-tabs>
                    </div>

                    <div v-else class="no-result-message">
                        <a-empty description="暂无数据" />
                    </div>
                </a-card>
            </a-col>
        </a-row>
    </div>
</template>

<script setup>
    import { ref, onActivated, onDeactivated } from 'vue';
    import { message } from 'ant-design-vue';
    import EventBus from '../../utils/eventBus';
    import { BMP_EVENT_PAGE_ID } from '../../const/bmpConst';

    defineOptions({
        name: 'BgpLocRibStatisReport'
    });

    const columns = [
        {
            title: '统计类型',
            dataIndex: 'typeName',
            key: 'typeName',
            width: '60%'
        },
        {
            title: '数值',
            dataIndex: 'value',
            key: 'value',
            width: '40%',
            align: 'right'
        }
    ];

    // 客户端
    const clientList = ref([]);
    const activeClientKey = ref('');
    const statisticsMap = ref(new Map());

    const getClientStatistics = client => {
        const key = `${client.localIp}|${client.localPort}|${client.remoteIp}|${client.remotePort}`;
        return statisticsMap.value.get(key) || [];
    };

    const onStatisticsReport = result => {
        if (result.status === 'success') {
            const data = result.data;
            if (data && data.client && data.statistics) {
                const key = `${data.client.localIp}|${data.client.localPort}|${data.client.remoteIp}|${data.client.remotePort}`;
                statisticsMap.value.set(key, data.statistics);
            }
        }
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
                    const key = `${data.localIp}|${data.localPort}|${data.remoteIp}|${data.remotePort}`;
                    statisticsMap.value.delete(key);

                    if (clientList.value.length > 0 && !activeClientKey.value) {
                        activeClientKey.value = `${clientList.value[0].localIp}|${clientList.value[0].localPort}|${clientList.value[0].remoteIp}|${clientList.value[0].remotePort}`;
                    }
                }
            } else {
                // BMP 服务停止，清空所有数据
                clientList.value = [];
                activeClientKey.value = '';
                statisticsMap.value.clear();
            }

            if (clientList.value.length === 0) {
                activeClientKey.value = '';
            }
        } else {
            console.error('termination handler error', result.msg);
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

    onActivated(async () => {
        clientList.value = [];
        activeClientKey.value = '';
        statisticsMap.value.clear();
        EventBus.on('bmp:initiation', BMP_EVENT_PAGE_ID.PAGE_ID_BMP_BGP_LOC_RIB_STATIS_REPORT, onClientListUpdate);
        EventBus.on('bmp:termination', BMP_EVENT_PAGE_ID.PAGE_ID_BMP_BGP_LOC_RIB_STATIS_REPORT, onTerminationHandler);
        EventBus.on(
            'bmp:statisticsReport',
            BMP_EVENT_PAGE_ID.PAGE_ID_BMP_BGP_LOC_RIB_STATIS_REPORT,
            onStatisticsReport
        );
        await loadClientList();
    });

    onDeactivated(() => {
        EventBus.off('bmp:initiation', BMP_EVENT_PAGE_ID.PAGE_ID_BMP_BGP_LOC_RIB_STATIS_REPORT);
        EventBus.off('bmp:termination', BMP_EVENT_PAGE_ID.PAGE_ID_BMP_BGP_LOC_RIB_STATIS_REPORT);
        EventBus.off('bmp:statisticsReport', BMP_EVENT_PAGE_ID.PAGE_ID_BMP_BGP_LOC_RIB_STATIS_REPORT);
    });
</script>

<style scoped>
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
