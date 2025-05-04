<template>
    <div class="rpki-client-detail-container">
        <a-row :gutter="16">
            <a-col :span="24">
                <a-card :title="`RPKI客户端: ${clientInfo.remoteIp}:${clientInfo.remotePort}`" class="client-info-card">
                    <a-descriptions :column="3" bordered size="small">
                        <a-descriptions-item label="客户端IP">{{ clientInfo.remoteIp }}</a-descriptions-item>
                        <a-descriptions-item label="客户端端口">{{ clientInfo.remotePort }}</a-descriptions-item>
                        <a-descriptions-item label="主机名">{{ clientInfo.hostname || '-' }}</a-descriptions-item>
                        <a-descriptions-item label="连接时间">
                            {{ clientInfo.connectedAt ? new Date(clientInfo.connectedAt).toLocaleString() : '-' }}
                        </a-descriptions-item>
                        <a-descriptions-item label="状态">
                            <a-tag color="green">已连接</a-tag>
                        </a-descriptions-item>
                    </a-descriptions>
                </a-card>
            </a-col>
        </a-row>

        <a-row :gutter="16" class="action-row">
            <a-col :span="24">
                <a-space>
                    <a-button type="primary" @click="showAddRoaModal">添加 ROA 条目</a-button>
                    <a-button danger @click="confirmClearAllRoa">清空所有 ROA 条目</a-button>
                    <a-button @click="refreshRoaList">刷新</a-button>
                </a-space>
            </a-col>
        </a-row>

        <a-row :gutter="16">
            <a-col :span="24">
                <a-card title="ROA 条目列表" class="roa-card">
                    <a-table
                        :columns="roaColumns"
                        :data-source="roaList"
                        :rowKey="record => `${record.asn}-${record.prefix}-${record.maxLength}`"
                        :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 条记录` }"
                        size="small"
                    >
                        <template #bodyCell="{ column, record }">
                            <template v-if="column.key === 'asn'">
                                AS{{ record.asn }}
                            </template>
                            <template v-if="column.key === 'status'">
                                <a-tag :color="record.status === 'active' ? 'green' : 'orange'">
                                    {{ record.status === 'active' ? '生效' : '未生效' }}
                                </a-tag>
                            </template>
                            <template v-if="column.key === 'action'">
                                <a-space>
                                    <a-button type="link" @click="editRoa(record)">编辑</a-button>
                                    <a-button type="link" danger @click="confirmDeleteRoa(record)">删除</a-button>
                                </a-space>
                            </template>
                        </template>
                    </a-table>
                </a-card>
            </a-col>
        </a-row>

        <!-- 添加/编辑 ROA 条目模态框 -->
        <a-modal
            v-model:open="roaModalVisible"
            :title="isEditing ? '编辑 ROA 条目' : '添加 ROA 条目'"
            :confirmLoading="confirmLoading"
            @ok="handleRoaModalOk"
            @cancel="roaModalVisible = false"
            :maskClosable="false"
        >
            <a-form :model="roaForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="roaFormRef">
                <a-form-item
                    label="AS号"
                    name="asn"
                    :rules="[{ required: true, message: '请输入AS号' }]"
                >
                    <a-input-number v-model:value="roaForm.asn" :min="1" :max="4294967295" style="width: 100%" />
                </a-form-item>
                <a-form-item
                    label="前缀"
                    name="prefix"
                    :rules="[
                        { required: true, message: '请输入前缀' },
                        { validator: validatePrefix }
                    ]"
                >
                    <a-input v-model:value="roaForm.prefix" placeholder="例如: 192.168.0.0/24 或 2001:db8::/32" />
                </a-form-item>
                <a-form-item
                    label="最大长度"
                    name="maxLength"
                    :rules="[
                        { required: true, message: '请输入最大长度' },
                        { validator: validateMaxLength }
                    ]"
                >
                    <a-input-number
                        v-model:value="roaForm.maxLength"
                        :min="0"
                        :max="128"
                        style="width: 100%"
                    />
                </a-form-item>
            </a-form>
        </a-modal>
    </div>
</template>

<script setup>
    import { ref, onMounted, onBeforeUnmount, reactive, computed } from 'vue';
    import { message, Modal } from 'ant-design-vue';
    import { useRoute } from 'vue-router';

    defineOptions({
        name: 'RpkiClientDetail'
    });

    const route = useRoute();
    const clientId = computed(() => route.params.clientId);

    const clientInfo = ref({
        remoteIp: '',
        remotePort: '',
        hostname: '',
        connectedAt: null
    });

    const roaList = ref([]);
    const refreshTimer = ref(null);

    const roaColumns = [
        {
            title: 'AS号',
            dataIndex: 'asn',
            key: 'asn',
            width: 100
        },
        {
            title: '前缀',
            dataIndex: 'prefix',
            key: 'prefix',
            ellipsis: true
        },
        {
            title: '最大长度',
            dataIndex: 'maxLength',
            key: 'maxLength',
            width: 100
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100
        },
        {
            title: '添加时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            customRender: ({ text }) => {
                if (!text) return '-';
                return new Date(text).toLocaleString();
            }
        },
        {
            title: '操作',
            key: 'action',
            width: 150
        }
    ];

    // ROA表单相关
    const roaModalVisible = ref(false);
    const confirmLoading = ref(false);
    const isEditing = ref(false);
    const roaFormRef = ref(null);
    const roaForm = reactive({
        asn: null,
        prefix: '',
        maxLength: null,
        id: null
    });

    // 验证前缀格式
    const validatePrefix = async (rule, value) => {
        if (!value) return Promise.resolve();

        // 简单验证IPv4或IPv6前缀格式
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){1,7}([0-9a-fA-F]{1,4}|:)\/\d{1,3}$/;

        if (!ipv4Regex.test(value) && !ipv6Regex.test(value)) {
            return Promise.reject('前缀格式不正确，应为IP地址/掩码长度');
        }

        const parts = value.split('/');
        const prefixLength = parseInt(parts[1], 10);

        // 检查前缀长度是否合法
        if (ipv4Regex.test(value) && (prefixLength < 0 || prefixLength > 32)) {
            return Promise.reject('IPv4前缀长度应在0-32之间');
        }

        if (ipv6Regex.test(value) && (prefixLength < 0 || prefixLength > 128)) {
            return Promise.reject('IPv6前缀长度应在0-128之间');
        }

        return Promise.resolve();
    };

    // 验证最大长度
    const validateMaxLength = async (rule, value) => {
        if (value === null || value === undefined) return Promise.resolve();

        const prefix = roaForm.prefix;
        if (!prefix) return Promise.resolve();

        const prefixLength = parseInt(prefix.split('/')[1], 10);

        if (value < prefixLength) {
            return Promise.reject('最大长度不能小于前缀长度');
        }

        // 检查最大长度是否在合理范围内
        if (prefix.includes('.') && value > 32) {
            return Promise.reject('IPv4最大长度不能超过32');
        }

        if (prefix.includes(':') && value > 128) {
            return Promise.reject('IPv6最大长度不能超过128');
        }

        return Promise.resolve();
    };

    // 获取客户端详细信息
    const fetchClientInfo = async () => {
        try {
            const decodedClientId = decodeURIComponent(clientId.value);
            const parts = decodedClientId.split('|');

            if (parts.length < 2) {
                message.error('无效的客户端ID');
                return;
            }

            const client = {
                remoteIp: parts[0],
                remotePort: parts[1]
            };

            const result = await window.rpkiApi.getClient(client);

            if (result.status === 'success' && result.data) {
                clientInfo.value = result.data;
            } else {
                message.error(result.msg || '获取客户端信息失败');
            }
        } catch (error) {
            console.error('获取客户端信息出错:', error);
            message.error(`获取客户端信息出错: ${error.message}`);
        }
    };

    // 获取ROA条目列表
    const fetchRoaList = async () => {
        try {
            const decodedClientId = decodeURIComponent(clientId.value);
            const parts = decodedClientId.split('|');

            if (parts.length < 2) {
                message.error('无效的客户端ID');
                return;
            }

            const client = {
                remoteIp: parts[0],
                remotePort: parts[1]
            };

            const result = await window.rpkiApi.getRoaList(client);

            if (result.status === 'success') {
                roaList.value = result.data || [];
            } else {
                message.error(result.msg || '获取ROA条目失败');
            }
        } catch (error) {
            console.error('获取ROA条目出错:', error);
            message.error(`获取ROA条目出错: ${error.message}`);
        }
    };

    // 刷新ROA列表
    const refreshRoaList = () => {
        fetchRoaList();
    };

    // 显示添加ROA模态框
    const showAddRoaModal = () => {
        isEditing.value = false;
        resetRoaForm();
        roaModalVisible.value = true;
    };

    // 编辑ROA条目
    const editRoa = record => {
        isEditing.value = true;
        roaForm.id = record.id;
        roaForm.asn = record.asn;
        roaForm.prefix = record.prefix;
        roaForm.maxLength = record.maxLength;
        roaModalVisible.value = true;
    };

    // 确认删除ROA条目
    const confirmDeleteRoa = record => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除AS${record.asn} ${record.prefix}吗？`,
            okText: '确认',
            cancelText: '取消',
            onOk: () => deleteRoa(record)
        });
    };

    // 删除ROA条目
    const deleteRoa = async record => {
        try {
            const decodedClientId = decodeURIComponent(clientId.value);
            const parts = decodedClientId.split('|');

            const client = {
                remoteIp: parts[0],
                remotePort: parts[1]
            };

            const result = await window.rpkiApi.deleteRoa({
                client,
                roa: {
                    id: record.id,
                    asn: record.asn,
                    prefix: record.prefix,
                    maxLength: record.maxLength
                }
            });

            if (result.status === 'success') {
                message.success('ROA条目删除成功');
                fetchRoaList();
            } else {
                message.error(result.msg || 'ROA条目删除失败');
            }
        } catch (error) {
            console.error('删除ROA条目出错:', error);
            message.error(`删除ROA条目出错: ${error.message}`);
        }
    };

    // 确认清空所有ROA条目
    const confirmClearAllRoa = () => {
        Modal.confirm({
            title: '确认清空所有ROA条目',
            content: '此操作将清空所有ROA条目，不可恢复，确认继续吗？',
            okText: '确认',
            cancelText: '取消',
            okType: 'danger',
            onOk: clearAllRoa
        });
    };

    // 清空所有ROA条目
    const clearAllRoa = async () => {
        try {
            const decodedClientId = decodeURIComponent(clientId.value);
            const parts = decodedClientId.split('|');

            const client = {
                remoteIp: parts[0],
                remotePort: parts[1]
            };

            const result = await window.rpkiApi.clearAllRoa(client);

            if (result.status === 'success') {
                message.success('所有ROA条目已清空');
                fetchRoaList();
            } else {
                message.error(result.msg || '清空ROA条目失败');
            }
        } catch (error) {
            console.error('清空ROA条目出错:', error);
            message.error(`清空ROA条目出错: ${error.message}`);
        }
    };

    // 重置ROA表单
    const resetRoaForm = () => {
        roaForm.id = null;
        roaForm.asn = null;
        roaForm.prefix = '';
        roaForm.maxLength = null;

        if (roaFormRef.value) {
            roaFormRef.value.resetFields();
        }
    };

    // 处理添加/编辑ROA模态框确认
    const handleRoaModalOk = () => {
        if (roaFormRef.value) {
            roaFormRef.value.validate().then(() => {
                if (isEditing.value) {
                    updateRoa();
                } else {
                    addRoa();
                }
            }).catch(error => {
                console.log('验证失败:', error);
            });
        }
    };

    // 添加ROA条目
    const addRoa = async () => {
        try {
            confirmLoading.value = true;

            const decodedClientId = decodeURIComponent(clientId.value);
            const parts = decodedClientId.split('|');

            const client = {
                remoteIp: parts[0],
                remotePort: parts[1]
            };

            const result = await window.rpkiApi.addRoa({
                client,
                roa: {
                    asn: roaForm.asn,
                    prefix: roaForm.prefix,
                    maxLength: roaForm.maxLength
                }
            });

            if (result.status === 'success') {
                message.success('ROA条目添加成功');
                roaModalVisible.value = false;
                fetchRoaList();
            } else {
                message.error(result.msg || 'ROA条目添加失败');
            }
        } catch (error) {
            console.error('添加ROA条目出错:', error);
            message.error(`添加ROA条目出错: ${error.message}`);
        } finally {
            confirmLoading.value = false;
        }
    };

    // 更新ROA条目
    const updateRoa = async () => {
        try {
            confirmLoading.value = true;

            const decodedClientId = decodeURIComponent(clientId.value);
            const parts = decodedClientId.split('|');

            const client = {
                remoteIp: parts[0],
                remotePort: parts[1]
            };

            const result = await window.rpkiApi.updateRoa({
                client,
                roa: {
                    id: roaForm.id,
                    asn: roaForm.asn,
                    prefix: roaForm.prefix,
                    maxLength: roaForm.maxLength
                }
            });

            if (result.status === 'success') {
                message.success('ROA条目更新成功');
                roaModalVisible.value = false;
                fetchRoaList();
            } else {
                message.error(result.msg || 'ROA条目更新失败');
            }
        } catch (error) {
            console.error('更新ROA条目出错:', error);
            message.error(`更新ROA条目出错: ${error.message}`);
        } finally {
            confirmLoading.value = false;
        }
    };

    onMounted(async () => {
        await fetchClientInfo();
        await fetchRoaList();

        // 设置定时刷新
        refreshTimer.value = setInterval(fetchRoaList, 10000);
    });

    onBeforeUnmount(() => {
        if (refreshTimer.value) {
            clearInterval(refreshTimer.value);
        }
    });
</script>

<style scoped>
    .rpki-client-detail-container {
        padding: 16px;
    }

    .client-info-card,
    .roa-card {
        margin-bottom: 16px;
    }

    .action-row {
        margin: 16px 0;
    }
</style>
