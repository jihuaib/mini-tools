<template>
    <a-modal
        v-model:open="modalVisible"
        title="报文解析结果"
        :mask-closable="false"
        :footer="null"
        class="modal-xlarge"
        @cancel="handleClose"
    >
        <div class="packet-result-viewer">
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
                    v-if="parsedTreeData && parsedTreeData.length > 0"
                    ref="treeRef"
                    v-model:selected-keys="treeSelectedKeys"
                    :tree-data="parsedTreeData"
                    :default-expand-all="true"
                    :height="480"
                    @select="onTreeNodeSelect"
                />
                <div v-else class="no-data-message">暂无解析数据</div>
            </a-card>
        </div>
    </a-modal>
</template>

<script setup>
    import { ref, computed, watch } from 'vue';

    defineOptions({
        name: 'PacketResultViewer'
    });

    const props = defineProps({
        open: {
            type: Boolean,
            default: false
        },
        packetData: {
            type: String,
            default: ''
        },
        rawParseResult: {
            type: Object,
            default: () => null
        }
    });

    const emit = defineEmits(['update:open']);

    const hexViewRef = ref(null);
    const treeRef = ref(null);
    const selectedNode = ref(null);
    const treeSelectedKeys = ref([]);
    const hexBuffer = ref([]);

    // 计算属性处理弹窗显示状态
    const modalVisible = computed({
        get: () => props.open,
        set: value => emit('update:open', value)
    });

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

    // 计算十六进制行数据
    const hexRows = computed(() => {
        const rows = [];
        for (let i = 0; i < hexBuffer.value.length; i += 16) {
            rows.push(hexBuffer.value.slice(i, i + 16));
        }
        return rows;
    });

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

    // 使用原始解析结果生成树数据
    const parsedTreeData = computed(() => {
        if (!props.rawParseResult || !props.rawParseResult.tree) {
            return [];
        }

        const tree = props.rawParseResult.tree;
        // 创建根节点
        return [
            {
                title: tree.name + (tree.value ? `: ${tree.value}` : ''),
                key: '0',
                dataRef: {
                    offset: tree.offset || 0,
                    length: tree.length || 0,
                    value: tree.value || ''
                },
                children: tree.children ? transformTreeData(tree.children, '0') : []
            }
        ];
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

    // 处理树节点选择
    const onTreeNodeSelect = (selectedKeys, info) => {
        if (selectedKeys.length > 0 && info.node.dataRef) {
            selectedNode.value = info.node.dataRef;

            // 滚动到相应的hex view位置
            if (hexViewRef.value) {
                const rowIndex = Math.floor(selectedNode.value.offset / 16);
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

    // 关闭弹窗
    const handleClose = () => {
        emit('update:open', false);
        // 清空选中状态
        selectedNode.value = null;
        treeSelectedKeys.value = [];
    };

    // 监听报文数据变化，更新十六进制缓冲区
    watch(
        () => props.packetData,
        newData => {
            if (newData) {
                hexBuffer.value = parseHexString(newData);
            } else {
                hexBuffer.value = [];
            }
        },
        { immediate: true }
    );

    // 监听弹窗打开，重置状态
    watch(
        () => props.open,
        newVisible => {
            if (newVisible) {
                selectedNode.value = null;
                treeSelectedKeys.value = [];
            }
        }
    );
</script>

<style scoped>
    .packet-result-viewer {
        display: flex;
        /* gap: 16px; */
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
        font-size: 12px;
    }

    .hex-content {
        font-family: monospace;
        white-space: pre;
        font-size: 12px;
        height: 480px;
        overflow: auto;
        border: 1px solid #f0f0f0;
        background-color: #fafafa;
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

    .no-data-message {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        width: 100%;
        color: #999;
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

    :deep(.ant-card-body) {
        padding: 2px;
    }
</style>
