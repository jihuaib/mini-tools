<template>
    <div class="mt-container">
        <a-card title="报文解析器">
            <div class="packet-parser-container">
                <!-- 表单区域（放在最上面） -->
                <div class="parser-form-section">
                    <a-form
                        :model="formState"
                        :label-col="labelCol"
                        :wrapper-col="wrapperCol"
                        @finish="handleParsePacket"
                    >
                        <!-- 左右布局的表单容器 -->
                        <div class="form-row-container">
                            <!-- 左侧表单项 -->
                            <div class="form-column left-column">
                                <!-- 解析起始层 -->
                                <a-form-item label="解析起始层" name="startLayer">
                                    <a-select v-model:value="formState.startLayer">
                                        <a-select-option :value="START_LAYER.L2">数据链路层</a-select-option>
                                        <a-select-option :value="START_LAYER.L3">网络层</a-select-option>
                                        <a-select-option :value="START_LAYER.L5">应用层</a-select-option>
                                    </a-select>
                                </a-form-item>

                                <!-- 报文类型选择 -->
                                <a-form-item label="应用协议类型" name="protocolType">
                                    <a-select v-model:value="formState.protocolType">
                                        <a-select-option :value="PROTOCOL_TYPE.AUTO">自动识别</a-select-option>
                                        <a-select-option :value="PROTOCOL_TYPE.BGP">BGP</a-select-option>
                                        <!-- 预留其他报文类型 -->
                                    </a-select>
                                </a-form-item>

                                <!-- 协议端口输入 -->
                                <a-form-item label="应用协议端口" name="protocolPort">
                                    <a-tooltip
                                        :title="validationErrors.protocolPort"
                                        :open="!!validationErrors.protocolPort"
                                    >
                                        <div class="port-filter-container">
                                            <a-input
                                                v-model:value="formState.protocolPort"
                                                :status="validationErrors.protocolPort ? 'error' : ''"
                                            />
                                        </div>
                                    </a-tooltip>
                                </a-form-item>
                            </div>

                            <!-- 右侧表单项 -->
                            <div class="form-column right-column">
                                <!-- 报文输入框 -->
                                <a-form-item label="报文数据" name="packetData">
                                    <a-tooltip
                                        :title="validationErrors.packetData"
                                        :open="!!validationErrors.packetData"
                                    >
                                        <ScrollTextarea
                                            v-model:modelValue="formState.packetData"
                                            :height="130"
                                            placeholder="请输入16进制格式的报文内容, 如: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF 00 13 01"
                                            :status="validationErrors.packetData ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </div>
                        </div>

                        <!-- 操作按钮 -->
                        <a-form-item :wrapper-col="{ span: 24 }">
                            <div class="form-buttons">
                                <a-button type="primary" html-type="submit">解析报文</a-button>
                                <a-button type="default" @click="showParseHistory">识别历史</a-button>
                            </div>
                        </a-form-item>
                    </a-form>
                </div>

                <!-- 结果显示区域（十六进制和树结构左右排列） -->
                <div v-if="parsedResult" class="parser-result-section">
                    <!-- 十六进制视图 -->
                    <a-card title="报文十六进制视图" class="result-card hex-view-card">
                        <div ref="hexViewRef" class="hex-content">
                            <div v-for="(row, rowIndex) in hexRows" :key="rowIndex" class="hex-data-row">
                                <div class="offset-col">{{ formatOffset(rowIndex * 16) }}</div>
                                <div class="hex-col">
                                    <div
                                        v-for="(byte, byteIndex) in row"
                                        :key="byteIndex"
                                        :class="getByteCellClass(rowIndex * 16 + byteIndex)"
                                        @click="onByteClick(rowIndex * 16 + byteIndex)"
                                    >
                                        {{ byte }}
                                    </div>
                                </div>
                                <div class="ascii-col">
                                    <div
                                        v-for="(byte, byteIndex) in row"
                                        :key="byteIndex"
                                        :class="getAsciiCellClass(rowIndex * 16 + byteIndex)"
                                        @click="onByteClick(rowIndex * 16 + byteIndex)"
                                    >
                                        {{ formatAscii(byte) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a-card>

                    <!-- 结构树视图 -->
                    <a-card title="报文结构树" class="result-card tree-view-card">
                        <a-tree
                            v-if="parsedTreeData.length > 0"
                            ref="treeRef"
                            v-model:selectedKeys="treeSelectedKeys"
                            :tree-data="parsedTreeData"
                            :default-expand-all="true"
                            :height="310"
                            @select="onTreeNodeSelect"
                        />
                        <div v-else class="no-data-message">暂无解析数据</div>
                    </a-card>
                </div>
                <div v-else class="no-result-message">
                    <a-empty description="请输入报文数据并点击解析报文按钮开始解析" />
                </div>
            </div>
        </a-card>
    </div>

    <!-- 解析历史弹窗 -->
    <a-modal
        v-model:open="historyModalVisible"
        title="报文解析历史"
        width="700px"
        :mask-closable="false"
        @cancel="closeHistoryModal"
    >
        <div class="history-modal-content">
            <a-table
                :columns="historyColumns"
                :data-source="parseHistory"
                :pagination="{ pageSize: 5, showSizeChanger: false, position: ['bottomCenter'] }"
                :scroll="{ y: 200 }"
                size="small"
            >
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'action'">
                        <a-button type="link" @click="loadHistoryItem(record)">使用</a-button>
                    </template>
                    <template v-else-if="column.key === 'packetData'">
                        <div class="history-packet-data">{{ truncateString(record.packetData, 40) }}</div>
                    </template>
                </template>
            </a-table>
        </div>
        <template #footer>
            <a-button type="primary" @click="closeHistoryModal">关闭</a-button>
            <a-button v-if="parseHistory.length > 0" type="danger" @click="clearHistory">清空历史</a-button>
        </template>
    </a-modal>
</template>

<script setup>
    import ScrollTextarea from '../../components/ScrollTextarea.vue';
    import { ref, onMounted, computed } from 'vue';
    import { message } from 'ant-design-vue';
    import { FormValidator, createPacketDataValidationRules } from '../../utils/validationCommon';
    import { PROTOCOL_TYPE, START_LAYER, START_LAYER_NAME, PROTOCOL_TYPE_NAME } from '../../const/toolsConst';
    defineOptions({
        name: 'PacketParser'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };
    const hexViewRef = ref(null);
    const treeRef = ref(null);

    const validationErrors = ref({
        packetData: '',
        protocolPort: ''
    });

    const formState = ref({
        startLayer: START_LAYER.L2,
        protocolType: PROTOCOL_TYPE.AUTO,
        protocolPort: '',
        packetData: ''
    });

    // 解析结果
    const parsedResult = ref(null);
    const selectedNode = ref(null);
    const parsedTreeData = ref([]);
    const treeSelectedKeys = ref([]);
    const hexBuffer = ref([]);
    const hexRows = computed(() => {
        const rows = [];
        for (let i = 0; i < hexBuffer.value.length; i += 16) {
            rows.push(hexBuffer.value.slice(i, i + 16));
        }
        return rows;
    });

    // 处理十六进制显示相关函数
    const formatOffset = offset => {
        return offset.toString(16).padStart(8, '0').toUpperCase();
    };

    const formatAscii = hexByte => {
        const byte = parseInt(hexByte, 16);
        if (byte >= 32 && byte <= 126) {
            return String.fromCharCode(byte);
        }
        return '.';
    };

    const isHighlighted = byteIndex => {
        if (!selectedNode.value) return false;

        const { offset, length } = selectedNode.value;
        return byteIndex >= offset && byteIndex < offset + length;
    };

    const getByteCellClass = byteIndex => {
        return {
            'hex-byte': true,
            highlighted: isHighlighted(byteIndex),
            clickable: true
        };
    };

    const getAsciiCellClass = byteIndex => {
        return {
            'ascii-byte': true,
            highlighted: isHighlighted(byteIndex),
            clickable: true
        };
    };

    // 将十六进制字符串转换为字节数组
    const parseHexString = hexString => {
        const sanitized = hexString.replace(/\s+/g, '');
        const result = [];

        for (let i = 0; i < sanitized.length; i += 2) {
            if (i + 1 >= sanitized.length) break;
            const byte = sanitized.substr(i, 2);
            result.push(byte.toUpperCase());
        }

        return result;
    };

    // 处理树节点选择
    const onTreeNodeSelect = (selectedKeys, info) => {
        if (selectedKeys.length > 0 && info.node.dataRef) {
            selectedNode.value = info.node.dataRef;

            // 滚动到相应的hex view位置
            if (hexViewRef.value) {
                const rowIndex = Math.floor(selectedNode.value.offset / 16);
                // 直接查找 .hex-data-row 元素而不是通过 tbody tr 选择器
                const rows = hexViewRef.value.querySelectorAll('.hex-data-row');
                if (rows && rows.length > rowIndex) {
                    rows[rowIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        } else {
            selectedNode.value = null;
        }
    };

    // 点击字节时查找并选择对应的树节点
    const onByteClick = byteIndex => {
        if (!parsedTreeData.value || parsedTreeData.value.length === 0) return;

        // 查找包含该字节偏移量的节点
        const nodeKey = findNodeKeyByByteOffset(parsedTreeData.value, byteIndex);

        if (nodeKey) {
            // 程序化选择树节点
            selectTreeNode(nodeKey);
        }
    };

    // 递归查找包含指定字节偏移量的节点的key
    const findNodeKeyByByteOffset = (nodes, byteOffset, parentKey = '') => {
        if (!nodes || nodes.length === 0) return null;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const key = parentKey ? `${parentKey}-${i}` : `${i}`;

            // 检查当前节点是否包含该字节偏移量
            if (
                node.dataRef &&
                byteOffset >= node.dataRef.offset &&
                byteOffset < node.dataRef.offset + node.dataRef.length
            ) {
                // 如果有子节点，先递归检查子节点是否包含该偏移量
                // 这样可以确保我们找到最具体的子节点
                if (node.children && node.children.length > 0) {
                    const childKey = findNodeKeyByByteOffset(node.children, byteOffset, key);
                    if (childKey) return childKey;
                }

                // 如果没有更具体的子节点包含该偏移量，返回当前节点
                return key;
            }

            // 检查子节点
            if (node.children && node.children.length > 0) {
                const childKey = findNodeKeyByByteOffset(node.children, byteOffset, key);
                if (childKey) return childKey;
            }
        }

        return null;
    };

    // 程序化选择树节点
    const selectTreeNode = key => {
        if (!treeRef.value) return;

        // 更新选中节点
        const findNodeByKey = (nodes, targetKey, currentPath = []) => {
            if (!nodes) return null;

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const path = [...currentPath, i];
                const key = path.join('-');

                if (key === targetKey) {
                    return { node, key };
                }

                if (node.children) {
                    const result = findNodeByKey(node.children, targetKey, path);
                    if (result) return result;
                }
            }

            return null;
        };

        const nodeInfo = findNodeByKey(parsedTreeData.value, key);
        if (nodeInfo && nodeInfo.node.dataRef) {
            // 更新选中节点的信息
            selectedNode.value = nodeInfo.node.dataRef;

            // 设置当前选中的树节点key
            treeSelectedKeys.value = [key];

            // 滚动到节点位置
            if (treeRef.value) {
                treeRef.value.scrollTo({ key });
            }
        }
    };

    // 转换后端返回的解析树结构为前端Tree组件需要的格式
    const transformTreeData = (node, parentKey = '0') => {
        if (!node) return [];

        const result = [];
        let index = 0;

        for (const item of node) {
            const currentKey = `${parentKey}-${index}`;
            const treeNode = {
                title: item.name + (item.value ? `: ${item.value}` : ''),
                key: currentKey,
                dataRef: {
                    offset: item.offset,
                    length: item.length,
                    value: item.value
                }
            };

            if (item.children && item.children.length > 0) {
                treeNode.children = transformTreeData(item.children, currentKey);
            }

            result.push(treeNode);
            index++;
        }

        return result;
    };

    // 历史记录相关状态
    const historyModalVisible = ref(false);
    const parseHistory = ref([]);
    const historyColumns = [
        {
            title: '开始层级',
            dataIndex: 'startLayer',
            key: 'startLayer',
            customRender: ({ text }) => {
                return START_LAYER_NAME[text];
            }
        },
        {
            title: '协议类型',
            dataIndex: 'protocolType',
            key: 'protocolType',
            customRender: ({ text }) => {
                return PROTOCOL_TYPE_NAME[text];
            }
        },
        {
            title: '协议端口',
            dataIndex: 'protocolPort',
            key: 'protocolPort'
        },
        {
            title: '报文数据',
            dataIndex: 'packetData',
            key: 'packetData',
            ellipsis: true
        },
        {
            title: '操作',
            key: 'action'
        }
    ];

    // 截断显示内容
    const truncateString = (str, maxLength) => {
        if (!str) return '';
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    };

    // 显示历史记录弹窗
    const showParseHistory = async () => {
        try {
            const resp = await window.toolsApi.getPacketParserHistory();
            if (resp.status === 'success') {
                parseHistory.value = resp.data || [];
                historyModalVisible.value = true;
            } else {
                message.error(resp.msg || '获取历史记录失败');
            }
        } catch (e) {
            message.error(e.message || String(e));
            console.error('获取历史记录错误:', e);
        }
    };

    // 关闭历史记录弹窗
    const closeHistoryModal = () => {
        historyModalVisible.value = false;
    };

    // 加载历史记录项
    const loadHistoryItem = record => {
        if (!record) return;

        // 更新表单数据
        formState.value = {
            startLayer: record.startLayer || START_LAYER.L2,
            protocolType: record.protocolType || PROTOCOL_TYPE.AUTO,
            protocolPort: record.protocolPort || '',
            packetData: record.packetData || ''
        };

        // 关闭弹窗
        closeHistoryModal();

        // 自动执行解析
        handleParsePacket();
    };

    // 清空历史记录
    const clearHistory = async () => {
        try {
            const resp = await window.toolsApi.clearPacketParserHistory();
            if (resp.status === 'success') {
                parseHistory.value = [];
                message.success('历史记录已清空');
            } else {
                message.error(resp.msg || '清空历史记录失败');
            }
        } catch (e) {
            message.error(e.message || String(e));
            console.error('清空历史记录错误:', e);
        }
    };

    let validator = new FormValidator(validationErrors);
    validator.addRules(createPacketDataValidationRules());

    // 处理解析报文，添加历史记录保存
    const handleParsePacket = async () => {
        try {
            const hasError = validator.validate(formState.value);
            if (hasError) {
                message.error('请检查配置信息是否正确');
                return;
            }

            const payload = {
                protocolType: formState.value.protocolType,
                protocolPort: formState.value.protocolPort,
                packetData: formState.value.packetData,
                startLayer: formState.value.startLayer
            };

            let resp;

            // 根据报文类型选择不同的解析方法
            resp = await window.toolsApi.parsePacket(payload);

            if (resp.status === 'success') {
                parsedResult.value = resp.data;
                hexBuffer.value = parseHexString(formState.value.packetData);

                // 处理树结构
                if (resp.data.tree) {
                    // 创建根节点
                    parsedTreeData.value = [
                        {
                            title: resp.data.tree.name + (resp.data.tree.value ? `: ${resp.data.tree.value}` : ''),
                            key: '0',
                            dataRef: {
                                offset: resp.data.tree.offset || 0,
                                length: resp.data.tree.length || 0,
                                value: resp.data.tree.value || ''
                            },
                            children: resp.data.tree.children ? transformTreeData(resp.data.tree.children, '0') : []
                        }
                    ];
                } else {
                    parsedTreeData.value = [];
                }

                selectedNode.value = null;
                message.success('报文解析成功');
            } else {
                message.error(resp.msg || '解析失败');
                parsedResult.value = null;
                parsedTreeData.value = [];
                hexBuffer.value = [];
            }
        } catch (e) {
            message.error(e.message || String(e));
            console.error('解析错误:', e);
            parsedResult.value = null;
            parsedTreeData.value = [];
            hexBuffer.value = [];
        }
    };

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            if (validator) {
                validator.clearErrors();
            }
        }
    });

    onMounted(async () => {});
</script>

<style scoped>
    .packet-parser-card {
        margin: 10px;
        display: flex;
        flex-direction: column;
        height: calc(100vh - 80px);
        overflow: hidden;
    }

    .packet-parser-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 16px;
    }

    .parser-form-section {
        border-bottom: 1px solid #f0f0f0;
        overflow-y: auto;
        min-height: 221px;
        max-height: 221px;
        flex-shrink: 0;
    }

    /* 左右布局表单 */
    .form-row-container {
        display: flex;
        gap: 20px;
    }

    .form-column {
        display: flex;
        flex-direction: column;
    }

    .left-column {
        width: 300px;
        flex-shrink: 0;
    }

    .right-column {
        flex: 1;
    }

    /* 端口过滤样式 */
    .port-filter-container {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .port-separator {
        color: #666;
        font-weight: bold;
    }

    .parser-result-section {
        flex: 1;
        display: flex;
        gap: 16px;
        overflow: hidden;
        height: calc(100% - 240px);
        min-height: 300px;
    }

    .packet-result-container {
        display: flex;
        gap: 16px;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }

    .result-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    .hex-view-card {
        width: 50%;
    }

    .tree-view-card {
        width: 50%;
    }

    .form-buttons {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 8px;
    }

    .hex-content {
        font-family: monospace;
        white-space: pre;
        font-size: 12px;
        height: 100%;
        overflow: auto;
        max-height: 100%;
    }

    .hex-header-row {
        display: flex;
        padding: 8px 4px;
        background-color: #f5f5f5;
        border-bottom: 1px solid #ddd;
        font-weight: bold;
        position: sticky;
        top: 0;
        z-index: 1;
    }

    .hex-data-row {
        display: flex;
        padding: 2px 4px;
        border-bottom: 1px solid #f0f0f0;
    }

    .hex-data-row:hover {
        background-color: #f9f9f9;
    }

    .offset-col {
        width: 60px;
        flex-shrink: 0;
        color: #666;
        font-weight: 500;
    }

    .hex-col {
        flex: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .ascii-col {
        width: 110px;
        flex-shrink: 0;
        display: flex;
        border-left: 1px solid #eee;
        padding-left: 8px;
    }

    .hex-byte {
        width: 7px;
        text-align: center;
        display: inline-block;
    }

    .ascii-byte {
        width: 6px;
        text-align: center;
        display: inline-block;
    }

    .highlighted {
        color: #ff0000;
        font-weight: bold;
        border-radius: 2px;
    }

    .clickable {
        cursor: pointer;
    }

    .clickable:hover {
        background-color: #e6f7ff;
    }

    .no-data-message,
    .no-result-message {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        width: 100%;
        color: #999;
        overflow: auto;
    }

    /* 树结构区域字体样式 */
    :deep(.ant-tree) {
        font-size: 13px;
        height: 100%;
        overflow: auto;
        max-height: 100%;
    }

    /* 设置树节点选中的颜色 */
    :deep(.ant-tree-node-selected) {
        background-color: rgba(255, 0, 0, 0.1) !important;
    }

    :deep(.ant-tree-node-content-wrapper.ant-tree-node-selected) {
        background-color: rgba(255, 0, 0, 0.1) !important;
    }

    :deep(.ant-tree-node-content-wrapper.ant-tree-node-selected .ant-tree-title) {
        color: #ff0000;
        font-weight: bold;
    }

    @media (max-width: 768px) {
        .parser-result-section {
            flex-direction: column;
        }

        .hex-view-card,
        .tree-view-card {
            width: 100%;
        }

        .form-row-container {
            flex-direction: column;
        }

        .left-column,
        .right-column {
            width: 100%;
        }
    }

    /* 历史记录样式 */
    .history-modal-content {
        max-height: 400px;
        overflow-y: auto;
    }

    .history-packet-data {
        font-family: monospace;
        word-break: break-all;
    }

    :deep(.ant-table-row) {
        cursor: pointer;
    }

    :deep(.ant-table-row:hover) {
        background-color: #f5f5f5;
    }

    :deep(.ant-table-body) {
        height: 200px !important;
        overflow-y: auto !important;
    }
</style>
