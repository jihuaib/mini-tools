<template>
    <div class="mt-container">
        <!-- 服务器配置 -->
        <a-row>
            <a-col :span="24">
                <a-card title="DHCP服务器配置">
                    <a-form :model="dhcpConfig" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="服务器IP">
                                    <a-input
                                        v-model:value="dhcpConfig.serverIp"
                                        placeholder="留空自动探测"
                                    />
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="子网掩码">
                                    <a-tooltip
                                        :title="validationErrors.subnetMask"
                                        :open="!!validationErrors.subnetMask"
                                    >
                                        <a-input
                                            v-model:value="dhcpConfig.subnetMask"
                                            placeholder="255.255.255.0"
                                            :status="validationErrors.subnetMask ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="网关">
                                    <a-input v-model:value="dhcpConfig.gateway" placeholder="192.168.1.1" />
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="IP池起始">
                                    <a-tooltip
                                        :title="validationErrors.poolStart"
                                        :open="!!validationErrors.poolStart"
                                    >
                                        <a-input
                                            v-model:value="dhcpConfig.poolStart"
                                            placeholder="192.168.1.100"
                                            :status="validationErrors.poolStart ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="IP池结束">
                                    <a-tooltip
                                        :title="validationErrors.poolEnd"
                                        :open="!!validationErrors.poolEnd"
                                    >
                                        <a-input
                                            v-model:value="dhcpConfig.poolEnd"
                                            placeholder="192.168.1.200"
                                            :status="validationErrors.poolEnd ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="租约时间(秒)">
                                    <a-tooltip
                                        :title="validationErrors.leaseTime"
                                        :open="!!validationErrors.leaseTime"
                                    >
                                        <a-input-number
                                            v-model:value="dhcpConfig.leaseTime"
                                            :min="60"
                                            :max="2592000"
                                            style="width: 100%"
                                            :status="validationErrors.leaseTime ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="DNS服务器1">
                                    <a-input v-model:value="dhcpConfig.dns1" placeholder="8.8.8.8" />
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="DNS服务器2">
                                    <a-input v-model:value="dhcpConfig.dns2" placeholder="8.8.4.4" />
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                            <a-space>
                                <a-button
                                    type="primary"
                                    :loading="serverLoading"
                                    :disabled="serverRunning"
                                    @click="startDhcp"
                                >
                                    启动服务器
                                </a-button>
                                <a-button type="primary" danger :disabled="!serverRunning" @click="stopDhcp">
                                    停止服务器
                                </a-button>
                                <a-tag :color="serverRunning ? 'success' : 'default'">
                                    {{ serverRunning ? '运行中' : '已停止' }}
                                </a-tag>
                            </a-space>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>

        <!-- 当前租约（简要） -->
        <a-row class="mt-margin-top-10">
            <a-col :span="24">
                <a-card title="当前租约">
                    <a-table
                        :columns="leaseColumns"
                        :data-source="leaseList"
                        :row-key="record => record.macAddr"
                        :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                        :scroll="{ y: 220 }"
                        size="small"
                    >
                        <template #bodyCell="{ column, record }">
                            <template v-if="column.key === 'action'">
                                <a-popconfirm
                                    title="确认释放此租约？"
                                    ok-text="确认"
                                    cancel-text="取消"
                                    @confirm="releaseLease(record)"
                                >
                                    <a-button type="link" danger :disabled="!serverRunning">释放</a-button>
                                </a-popconfirm>
                            </template>
                        </template>
                    </a-table>
                </a-card>
            </a-col>
        </a-row>
    </div>
</template>

<script setup>
    import { ref, onMounted, onActivated, onDeactivated } from 'vue';
    import { message } from 'ant-design-vue';
    import { DEFAULT_VALUES, DHCP_SUB_EVT_TYPES, DHCP_EVENT_PAGE_ID } from '../../const/dhcpConst';
    import EventBus from '../../utils/eventBus';

    defineOptions({ name: 'DhcpConfig' });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const dhcpConfig = ref({
        serverIp: '',
        poolStart: DEFAULT_VALUES.DEFAULT_POOL_START,
        poolEnd: DEFAULT_VALUES.DEFAULT_POOL_END,
        subnetMask: DEFAULT_VALUES.DEFAULT_SUBNET_MASK,
        gateway: DEFAULT_VALUES.DEFAULT_GATEWAY,
        dns1: DEFAULT_VALUES.DEFAULT_DNS1,
        dns2: DEFAULT_VALUES.DEFAULT_DNS2,
        leaseTime: DEFAULT_VALUES.DEFAULT_LEASE_TIME
    });

    const serverLoading = ref(false);
    const serverRunning = ref(false);
    const leaseList = ref([]);

    const validationErrors = ref({
        poolStart: '',
        poolEnd: '',
        subnetMask: '',
        leaseTime: ''
    });

    const leaseColumns = [
        { title: 'MAC地址', dataIndex: 'macAddr', key: 'macAddr', ellipsis: true },
        { title: 'IP地址', dataIndex: 'ip', key: 'ip', ellipsis: true },
        { title: '主机名', dataIndex: 'hostname', key: 'hostname', ellipsis: true },
        { title: '租约时间(秒)', dataIndex: 'leaseTime', key: 'leaseTime', width: 110 },
        { title: '到期时间', dataIndex: 'expiresAt', key: 'expiresAt', ellipsis: true },
        { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
        { title: '操作', key: 'action', width: 80 }
    ];

    const validateConfig = () => {
        const errors = {};
        const ipReg = /^(\d{1,3}\.){3}\d{1,3}$/;

        if (!ipReg.test(dhcpConfig.value.poolStart)) {
            errors.poolStart = '请输入有效的IP地址';
        }
        if (!ipReg.test(dhcpConfig.value.poolEnd)) {
            errors.poolEnd = '请输入有效的IP地址';
        }
        if (!ipReg.test(dhcpConfig.value.subnetMask)) {
            errors.subnetMask = '请输入有效的子网掩码';
        }
        if (!dhcpConfig.value.leaseTime || dhcpConfig.value.leaseTime < 60) {
            errors.leaseTime = '租约时间不能小于60秒';
        }

        validationErrors.value = errors;
        return Object.keys(errors).length === 0;
    };

    const startDhcp = async () => {
        if (!validateConfig()) {
            message.error('请检查配置信息是否正确');
            return;
        }

        try {
            const config = JSON.parse(JSON.stringify(dhcpConfig.value));
            const saveResult = await window.dhcpApi.saveDhcpConfig(config);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置保存失败');
                return;
            }

            serverLoading.value = true;
            const result = await window.dhcpApi.startDhcp(config);

            if (result.status === 'success') {
                message.success('DHCP服务器启动成功');
                serverRunning.value = true;
            } else {
                message.error(result.msg || 'DHCP服务器启动失败');
            }
        } catch (error) {
            message.error(`DHCP服务器启动出错: ${error.message}`);
        } finally {
            serverLoading.value = false;
        }
    };

    const stopDhcp = async () => {
        try {
            const result = await window.dhcpApi.stopDhcp();
            if (result.status === 'success') {
                message.success('DHCP服务器已停止');
                serverRunning.value = false;
                leaseList.value = [];
            } else {
                message.error(result.msg || 'DHCP服务器停止失败');
            }
        } catch (error) {
            message.error(`DHCP服务器停止出错: ${error.message}`);
        }
    };

    const releaseLease = async record => {
        try {
            const result = await window.dhcpApi.releaseLease(record.macAddr);
            if (result.status === 'success') {
                message.success(`租约 ${record.macAddr} 已释放`);
            } else {
                message.error(result.msg || '租约释放失败');
            }
        } catch (error) {
            message.error(`租约释放出错: ${error.message}`);
        }
    };

    const loadLeaseList = async () => {
        try {
            const result = await window.dhcpApi.getLeaseList();
            if (result.status === 'success') {
                leaseList.value = result.data || [];
            }
        } catch (error) {
            console.error('加载租约列表失败:', error);
        }
    };

    const onDhcpEvt = result => {
        if (result.status !== 'success') return;
        const data = result.data;

        if (data.type === DHCP_SUB_EVT_TYPES.DHCP_SUB_EVT_LEASE) {
            if (data.opType === 'add') {
                leaseList.value = [...leaseList.value, data.data];
            } else if (data.opType === 'remove') {
                leaseList.value = leaseList.value.filter(l => l.macAddr !== data.data.macAddr);
            } else if (data.opType === 'update') {
                const idx = leaseList.value.findIndex(l => l.macAddr === data.data.macAddr);
                if (idx !== -1) {
                    const newList = [...leaseList.value];
                    newList[idx] = data.data;
                    leaseList.value = newList;
                }
            }
        }
    };

    defineExpose({
        clearValidationErrors: () => {
            validationErrors.value = {
                poolStart: '',
                poolEnd: '',
                subnetMask: '',
                leaseTime: ''
            };
        }
    });

    onMounted(async () => {
        try {
            const result = await window.dhcpApi.getDhcpConfig();
            if (result.status === 'success' && result.data) {
                dhcpConfig.value = result.data;
            }
        } catch (error) {
            console.error('加载DHCP配置出错:', error);
        }
    });

    onActivated(async () => {
        EventBus.on('dhcp:event', DHCP_EVENT_PAGE_ID.PAGE_ID_DHCP_CONFIG, onDhcpEvt);
        await loadLeaseList();
    });

    onDeactivated(() => {
        EventBus.off('dhcp:event', DHCP_EVENT_PAGE_ID.PAGE_ID_DHCP_CONFIG);
    });
</script>

<style scoped>
    :deep(.ant-table-body) {
        height: 260px !important;
        overflow-y: auto !important;
    }
</style>
