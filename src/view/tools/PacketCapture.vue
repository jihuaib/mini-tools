<template>
    <div class="mt-container">
        <!-- 配置面板 -->
        <a-card title="抓包配置">
            <a-form :label-col="labelCol" :wrapper-col="wrapperCol">
                <a-form-item label="网络接口">
                    <a-select
                        v-model:value="selectedInterface"
                        placeholder="请选择网络接口"
                        :disabled="isCapturing"
                        @dropdown-visible-change="onInterfaceDropdownOpen"
                    >
                        <a-select-option v-for="iface in interfaces" :key="iface.name" :value="iface.name">
                            {{ iface.name }} - {{ iface.description }}
                        </a-select-option>
                    </a-select>
                </a-form-item>
                <a-form-item label="过滤器">
                    <a-input
                        v-model:value="captureFilter"
                        placeholder="BPF过滤器 (例如: tcp port 80, host 192.168.1.1)"
                        :disabled="isCapturing"
                    />
                </a-form-item>
                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                    <a-space>
                        <a-button
                            type="primary"
                            :loading="isStarting"
                            :disabled="!selectedInterface || isCapturing"
                            @click="startCapture"
                        >
                            开始抓包
                        </a-button>
                        <a-button danger :loading="isStopping" :disabled="!isCapturing" @click="stopCapture">
                            停止抓包
                        </a-button>
                        <a-button :disabled="isCapturing" @click="clearPackets">清空数据</a-button>
                    </a-space>
                </a-form-item>
            </a-form>
        </a-card>

        <!-- 数据包列表 -->
        <a-card title="抓包数据" class="mt-margin-top-10">
            <template #extra>
                <a-space>
                    <a-button :disabled="packets.length === 0" @click="exportPackets">导出数据</a-button>
                </a-space>
            </template>

            <a-table
                :columns="columns"
                :data-source="filteredPackets"
                :scroll="{ y: 300 }"
                :pagination="{ pageSize: 20, showSizeChanger: false, position: ['bottomCenter'] }"
                size="small"
                :custom-row="
                    record => ({
                        onClick: () => onRowClick(record)
                    })
                "
            >
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'timestamp'">
                        {{ formatTimestamp(record.timestamp) }}
                    </template>
                    <template v-else-if="column.key === 'length'">{{ record.length }} bytes</template>
                </template>
            </a-table>
        </a-card>
    </div>

    <!-- 报文结果查看器弹窗 -->
    <PacketResultViewer
        v-model:visible="resultViewerVisible"
        :packet-data="selectedPacket?.raw || selectedPacket?.hexData || ''"
        :raw-parse-result="rawParseResult"
    />
</template>

<script setup>
    import { ref, onMounted, onUnmounted, computed, toRaw } from 'vue';
    import { message } from 'ant-design-vue';
    import PacketResultViewer from '../../components/PacketResultViewer.vue';
    import { PROTOCOL_TYPE, START_LAYER } from '../../const/toolsConst';

    const resultViewerVisible = ref(false);

    defineOptions({
        name: 'PacketCapture'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    // 响应式数据
    const interfaces = ref([]);
    const selectedInterface = ref('');
    const captureFilter = ref('');
    const isCapturing = ref(false);
    const isStarting = ref(false);
    const isStopping = ref(false);
    const packets = ref([]);
    const currentDevice = ref('');
    const searchText = ref('');
    const selectedPacket = ref(null);
    const rawParseResult = ref(null);

    // 表格列定义
    const columns = [
        {
            title: '序号',
            dataIndex: 'id',
            key: 'id',
            width: 80,
            fixed: 'left'
        },
        {
            title: '时间',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 180
        },
        {
            title: '长度',
            dataIndex: 'length',
            key: 'length',
            width: 100
        },
        {
            title: '摘要',
            dataIndex: 'raw',
            key: 'raw',
            ellipsis: true
        }
    ];

    // 计算属性
    const filteredPackets = computed(() => {
        if (!searchText.value) return packets.value;

        const search = searchText.value.toLowerCase();
        return packets.value.filter(
            packet =>
                packet.protocol.toLowerCase().includes(search) ||
                packet.summary.toLowerCase().includes(search) ||
                (packet.ip && (packet.ip.src.includes(search) || packet.ip.dst.includes(search)))
        );
    });

    // 生命周期钩子
    onMounted(() => {
        loadInterfaces();
        setupPacketListener();
    });

    onUnmounted(() => {
        cleanupPacketListener();
    });

    // 方法
    function setupPacketListener() {
        if (window.nativeApi) {
            window.nativeApi.onPacketEvent(handlePacketCaptured);
        }
    }

    function cleanupPacketListener() {
        if (window.nativeApi) {
            window.nativeApi.offPacketEvent(handlePacketCaptured);
        }
    }

    function handlePacketCaptured(data) {
        console.log(`Packet event received:`, data);

        if (data.status === 'success' && data.data) {
            switch (data.data.type) {
                case 'PACKET_CAPTURE_START':
                    message.success(`抓包已开始 - 设备: ${data.data.device}`);
                    break;

                case 'PACKET_CAPTURED':
                    if (data.data.packet) {
                        packets.value.unshift(data.data.packet); // 新包添加到顶部
                        // 限制包数量，避免内存过多占用
                        if (packets.value.length > 10000) {
                            packets.value = packets.value.slice(0, 5000);
                        }
                    }
                    break;

                case 'PACKET_ERROR':
                    message.error(`抓包错误: ${data.msg || '未知错误'}`);
                    break;
            }
        } else if (data.status === 'error') {
            message.error(`抓包错误: ${data.msg || '未知错误'}`);
        }
    }

    async function loadInterfaces() {
        if (!window.nativeApi) return;

        try {
            const response = await window.nativeApi.getNetworkInterfaces();
            if (response.status === 'success') {
                interfaces.value = response.data || [];
            } else {
                message.error(`获取网卡列表失败: ${response.msg}`);
            }
        } catch (err) {
            message.error(`获取网卡列表失败: ${err.message}`);
        }
    }

    function onInterfaceDropdownOpen(open) {
        if (open && interfaces.value.length === 0) {
            loadInterfaces();
        }
    }

    async function startCapture() {
        if (!selectedInterface.value) {
            message.warning('请选择网络接口');
            return;
        }

        if (!window.nativeApi) {
            message.error('工具API不可用');
            return;
        }

        isStarting.value = true;

        try {
            const response = await window.nativeApi.startPacketCapture({
                deviceName: selectedInterface.value,
                filter: captureFilter.value
            });

            if (response.verify) {
                isCapturing.value = true;
                isStarting.value = false;
                currentDevice.value = selectedInterface.value;
                message.success(response.msg || '抓包已开始');
            } else {
                isStarting.value = false;
                message.error(`启动抓包失败: ${response.msg}`);
            }
        } catch (err) {
            isStarting.value = false;
            message.error(`启动抓包失败: ${err.message}`);
        }
    }

    async function stopCapture() {
        if (!window.nativeApi) {
            message.error('工具API不可用');
            return;
        }

        isStopping.value = true;

        try {
            const response = await window.nativeApi.stopPacketCapture();

            if (response.verify) {
                isCapturing.value = false;
                isStopping.value = false;
                message.success(response.msg || '抓包已停止');
            } else {
                isStopping.value = false;
                message.error(`停止抓包失败: ${response.msg}`);
            }
        } catch (err) {
            isStopping.value = false;
            message.error(`停止抓包失败: ${err.message}`);
        }
    }

    function clearPackets() {
        packets.value = [];
        message.success('数据已清空');
    }

    async function onRowClick(record) {
        selectedPacket.value = record;
        // 根据报文类型选择不同的解析方法
        const packetData = {
            protocolType: PROTOCOL_TYPE.AUTO,
            protocolPort: '',
            packetData: record.raw,
            startLayer: START_LAYER.L2
        };
        const resp = await window.toolsApi.parsePacket(packetData);

        if (resp.status === 'success') {
            rawParseResult.value = resp.data;
            message.success('报文解析成功');
            resultViewerVisible.value = true;
        } else {
            message.error(resp.msg || '解析失败');
            rawParseResult.value = null;
        }
    }

    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            hour12: false,
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    }

    async function exportPackets() {
        if (packets.value.length === 0) {
            message.warning('没有数据可以导出');
            return;
        }

        if (!window.nativeApi) {
            message.error('导出功能不可用');
            return;
        }

        try {
            const payload = JSON.parse(JSON.stringify(toRaw(packets.value)));
            const response = await window.nativeApi.exportPacketsToPcap(payload);

            if (response.status === 'success') {
                message.success(response.msg || 'PCAP 文件导出成功');
            } else {
                message.error(response.msg || '导出失败');
            }
        } catch (err) {
            message.error(`导出失败: ${err.message}`);
        }
    }

    // 暴露给父组件的方法
    defineExpose({
        clearValidationErrors: () => {
            // 抓包页面没有表单验证，这里为了保持一致性
        }
    });
</script>

<style scoped>
    :deep(.ant-table-body) {
        height: 400px !important;
        overflow-y: auto !important;
    }

    :deep(.ant-table-row) {
        cursor: pointer;
    }

    :deep(.ant-table-row:hover) {
        background-color: #f5f5f5;
    }
</style>
