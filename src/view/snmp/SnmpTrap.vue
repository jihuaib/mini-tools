<template>
    <div class="mt-container">
        <a-card title="SNMP Trap 监控" class="trap-card">
            <template #extra>
                <a-space>
                    <a-button :loading="clearLoading" @click="clearHistory">
                        <template #icon><DeleteOutlined /></template>
                        清空历史
                    </a-button>
                </a-space>
            </template>

            <!-- 统计信息 -->
            <a-row :gutter="16" class="stats-row">
                <a-col :span="6">
                    <a-statistic title="总接收数量" :value="totalTraps" prefix="#" />
                </a-col>
                <a-col :span="6">
                    <a-statistic title="今日接收" :value="todayTraps" prefix="#" />
                </a-col>
                <a-col :span="6">
                    <a-statistic title="最近1小时" :value="recentTraps" prefix="#" />
                </a-col>
                <a-col :span="6">
                    <a-statistic title="在线代理" :value="onlineAgents" prefix="#" />
                </a-col>
            </a-row>

            <!-- 筛选器 -->
            <a-row :gutter="16" class="filter-row">
                <a-col :span="6">
                    <a-select
                        v-model:value="filters.version"
                        placeholder="选择SNMP版本"
                        allow-clear
                        style="width: 100%"
                        @change="handleFilterChange"
                    >
                        <a-select-option value="v1">SNMPv1</a-select-option>
                        <a-select-option value="v2c">SNMPv2c</a-select-option>
                        <a-select-option value="v3">SNMPv3</a-select-option>
                    </a-select>
                </a-col>
                <a-col :span="6">
                    <a-input
                        v-model:value="filters.sourceIp"
                        placeholder="源IP地址"
                        allow-clear
                        @change="handleFilterChange"
                    />
                </a-col>
                <a-col :span="6">
                    <a-input
                        v-model:value="filters.community"
                        placeholder="Community"
                        allow-clear
                        @change="handleFilterChange"
                    />
                </a-col>
                <a-col :span="6">
                    <a-range-picker
                        v-model:value="filters.timeRange"
                        show-time
                        format="YYYY-MM-DD HH:mm:ss"
                        @change="handleFilterChange"
                    />
                </a-col>
            </a-row>

            <!-- Trap列表表格 -->
            <a-table
                :columns="columns"
                :data-source="filteredTraps"
                :loading="loading"
                :pagination="pagination"
                :scroll="{ y: 400 }"
                row-key="id"
                class="mt-margin-top-10"
                @change="handleTableChange"
            >
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'version'">
                        <a-tag :color="getVersionColor(record.version)">
                            {{ record.version.toUpperCase() }}
                        </a-tag>
                    </template>
                    <template v-else-if="column.key === 'status'">
                        <a-tag :color="getStatusColor(record.status)">
                            {{ getStatusText(record.status) }}
                        </a-tag>
                    </template>
                    <template v-else-if="column.key === 'timestamp'">
                        {{ formatTimestamp(record.timestamp) }}
                    </template>
                    <template v-else-if="column.key === 'action'">
                        <a-space>
                            <a-button type="link" size="small" @click="showTrapDetail(record)">
                                <template #icon><EyeOutlined /></template>
                                详情
                            </a-button>
                        </a-space>
                    </template>
                </template>
            </a-table>
        </a-card>

        <!-- Trap详情模态框 -->
        <a-modal v-model:open="detailModalVisible" title="Trap 详情" :footer="null" class="modal-xlarge">
            <div v-if="selectedTrap" class="trap-detail">
                <a-divider>基本信息</a-divider>
                <a-descriptions :column="2" bordered size="small">
                    <a-descriptions-item label="Trap ID">{{ selectedTrap.id }}</a-descriptions-item>
                    <a-descriptions-item label="接收时间">
                        {{ formatTimestamp(selectedTrap.timestamp) }}
                    </a-descriptions-item>
                    <a-descriptions-item label="源IP地址">{{ selectedTrap.sourceIp }}</a-descriptions-item>
                    <a-descriptions-item label="源端口">{{ selectedTrap.sourcePort }}</a-descriptions-item>
                    <a-descriptions-item label="SNMP版本">
                        <a-tag :color="getVersionColor(selectedTrap.version)">
                            {{ selectedTrap.version.toUpperCase() }}
                        </a-tag>
                    </a-descriptions-item>
                    <a-descriptions-item label="状态">
                        <a-tag :color="getStatusColor(selectedTrap.status)">
                            {{ getStatusText(selectedTrap.status) }}
                        </a-tag>
                    </a-descriptions-item>
                    <a-descriptions-item v-if="selectedTrap.community" label="Community">
                        {{ selectedTrap.community }}
                    </a-descriptions-item>
                    <a-descriptions-item v-if="selectedTrap.enterpriseOid" label="企业OID">
                        {{ selectedTrap.enterpriseOid }}
                    </a-descriptions-item>
                    <a-descriptions-item v-if="selectedTrap.genericType" label="通用类型">
                        {{ selectedTrap.genericType }}
                    </a-descriptions-item>
                    <a-descriptions-item v-if="selectedTrap.specificType" label="特定类型">
                        {{ selectedTrap.specificTrap }}
                    </a-descriptions-item>
                </a-descriptions>

                <!-- 变量绑定 -->
                <a-divider>变量绑定 (Variable Bindings)</a-divider>
                <a-table
                    :columns="varbindColumns"
                    :data-source="selectedTrap.varbinds || []"
                    size="small"
                    row-key="oid"
                    :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                    :scroll="{ y: 250, x: 700 }"
                >
                    <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'value'">
                            <div class="varbind-value">
                                <a-typography-text copyable>{{ record.value }}</a-typography-text>
                            </div>
                        </template>
                    </template>
                </a-table>
            </div>
        </a-modal>
    </div>
</template>

<script setup>
    import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
    import { message } from 'ant-design-vue';
    import { DeleteOutlined, EyeOutlined } from '@ant-design/icons-vue';
    import { SNMP_TRAP_STATUS, SNMP_SUB_EVT_TYPES } from '../../const/snmpConst';
    import dayjs from 'dayjs';

    defineOptions({ name: 'SnmpTrap' });

    const loading = ref(false);
    const clearLoading = ref(false);
    const detailModalVisible = ref(false);
    const selectedTrap = ref(null);
    const traps = ref([]);

    // 统计数据
    const totalTraps = ref(0);
    const todayTraps = ref(0);
    const recentTraps = ref(0);
    const onlineAgents = ref(0);

    // 筛选器
    const filters = reactive({
        version: null,
        sourceIp: '',
        community: '',
        timeRange: null
    });

    // 分页配置
    const pagination = reactive({
        current: 1,
        pageSize: 20,
        total: 0,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) => `共 ${total} 条记录，显示 ${range[0]}-${range[1]} 条`
    });

    // 表格列定义
    const columns = [
        {
            title: 'Trap ID',
            dataIndex: 'id',
            key: 'id',
            width: 120,
            sorter: true
        },
        {
            title: '接收时间',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 160,
            sorter: true
        },
        {
            title: '源IP',
            dataIndex: 'sourceIp',
            key: 'sourceIp',
            width: 120
        },
        {
            title: 'SNMP版本',
            dataIndex: 'version',
            key: 'version',
            width: 100
        },
        {
            title: 'Community',
            dataIndex: 'community',
            key: 'community',
            width: 120,
            ellipsis: true
        },
        {
            title: '企业OID',
            dataIndex: 'enterpriseOid',
            key: 'enterpriseOid',
            width: 200,
            ellipsis: true
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            fixed: 'right'
        }
    ];

    // 变量绑定表格列
    const varbindColumns = [
        {
            title: 'OID',
            dataIndex: 'oid',
            key: 'oid',
            width: 300,
            ellipsis: true
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            ellipsis: true
        },
        {
            title: '值',
            dataIndex: 'value',
            key: 'value',
            ellipsis: true
        }
    ];

    // 筛选后的数据
    const filteredTraps = computed(() => {
        let result = [...traps.value];

        if (filters.version) {
            result = result.filter(trap => trap.version === filters.version);
        }

        if (filters.sourceIp) {
            result = result.filter(trap => trap.sourceIp.includes(filters.sourceIp));
        }

        if (filters.community) {
            result = result.filter(trap => trap.community && trap.community.includes(filters.community));
        }

        if (filters.timeRange && filters.timeRange.length === 2) {
            const [start, end] = filters.timeRange;
            result = result.filter(trap => {
                const trapTime = dayjs(trap.timestamp);
                return trapTime.isAfter(start) && trapTime.isBefore(end);
            });
        }

        return result;
    });

    const getVersionColor = version => {
        const colors = {
            v1: 'blue',
            v2c: 'green',
            v3: 'purple'
        };
        return colors[version] || 'default';
    };

    const getStatusColor = status => {
        const colors = {
            [SNMP_TRAP_STATUS.WAITING]: 'orange',
            [SNMP_TRAP_STATUS.RECEIVED]: 'green',
            [SNMP_TRAP_STATUS.PROCESSED]: 'blue',
            [SNMP_TRAP_STATUS.ERROR]: 'red'
        };
        return colors[status] || 'default';
    };

    const getStatusText = status => {
        const texts = {
            [SNMP_TRAP_STATUS.WAITING]: '等待中',
            [SNMP_TRAP_STATUS.RECEIVED]: '已接收',
            [SNMP_TRAP_STATUS.PROCESSED]: '已处理',
            [SNMP_TRAP_STATUS.ERROR]: '错误'
        };
        return texts[status] || status;
    };

    const formatTimestamp = timestamp => {
        return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
    };

    const clearHistory = async () => {
        try {
            clearLoading.value = true;
            const result = await window.snmpApi.clearTrapHistory();
            if (result.status === 'success') {
                message.success('历史记录清空成功');
            } else {
                message.error(result.msg || '清空失败');
            }
        } catch (error) {
            message.error('清空失败: ' + error.message);
        } finally {
            clearLoading.value = false;
        }
    };

    const handleFilterChange = () => {
        pagination.current = 1;
        // 筛选是在前端进行的，不需要重新请求数据
    };

    const handleTableChange = pag => {
        pagination.current = pag.current;
        pagination.pageSize = pag.pageSize;
    };

    const showTrapDetail = trap => {
        selectedTrap.value = trap;
        detailModalVisible.value = true;
    };

    // 接收新的Trap事件
    const onTrapReceived = trapData => {
        // 在列表顶部添加新的Trap
        traps.value.unshift(trapData);
        // 更新统计数据
        totalTraps.value++;
        recentTraps.value++;
    };

    defineExpose({
        clearValidationErrors: () => {
            // 此组件无表单验证
        }
    });

    const handleSnmpEvent = respData => {
        if (respData.status === 'success') {
            const type = respData.data.type;
            if (type === SNMP_SUB_EVT_TYPES.TRAP_RECEIVED) {
                onTrapReceived(respData.data.data);
            }
        }
    };

    onMounted(() => {
        window.snmpApi.onSnmpEvent(handleSnmpEvent);
    });

    onBeforeUnmount(() => {
        window.snmpApi.offSnmpEvent(handleSnmpEvent);
    });
</script>

<style scoped>
    .varbind-value {
        width: 100px;
    }

    :deep(.ant-table-body) {
        height: 250px !important;
        overflow-y: auto !important;
    }
</style>
