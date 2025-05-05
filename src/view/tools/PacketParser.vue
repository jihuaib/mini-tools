<template>
    <a-card title="报文解析器" class="packet-parser-card">
        <a-form :model="formState" @finish="handleParsePacket" :label-col="labelCol" :wrapper-col="wrapperCol">
            <!-- 报文类型选择 -->
            <a-form-item label="报文类型" name="packetType">
                <a-select v-model:value="formState.packetType">
                    <a-select-option value="bgp">BGP</a-select-option>
                    <!-- 预留其他报文类型 -->
                </a-select>
            </a-form-item>

            <!-- 报文输入框 -->
            <a-form-item label="报文数据" name="packetData">
                <a-tooltip :title="validationErrors.packetData" :open="!!validationErrors.packetData">
                    <ScrollTextarea
                        v-model:modelValue="formState.packetData"
                        :height="100"
                        placeholder="请输入16进制格式的报文内容，如: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF 00 13 01"
                        @blur="e => validateField(e.target.value, 'packetData', validatePacketData)"
                        :status="validationErrors.packetData ? 'error' : ''"
                    />
                </a-tooltip>
            </a-form-item>

            <!-- 操作按钮 -->
            <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                <a-button type="primary" html-type="submit">解析报文</a-button>
            </a-form-item>
        </a-form>

        <div v-if="parsedResult" class="packet-result-container">
            <div class="result-row">
                <div class="packet-hex-view">
                    <a-card title="报文十六进制视图" class="hex-view-card">
                        <div class="hex-content" ref="hexViewRef">
                            <table class="hex-table">
                                <tbody>
                                    <tr v-for="(row, rowIndex) in hexRows" :key="`row-${rowIndex}`">
                                        <td class="offset-cell">{{ formatOffset(rowIndex * 16) }}</td>
                                        <td
                                            v-for="(byte, byteIndex) in row"
                                            :key="`byte-${rowIndex}-${byteIndex}`"
                                            :class="{ highlighted: isHighlighted(rowIndex * 16 + byteIndex) }"
                                        >
                                            {{ byte }}
                                        </td>
                                        <td class="ascii-cell">
                                            <span
                                                v-for="(byte, byteIndex) in row"
                                                :key="`ascii-${rowIndex}-${byteIndex}`"
                                                :class="{ highlighted: isHighlighted(rowIndex * 16 + byteIndex) }"
                                            >
                                                {{ formatAscii(byte) }}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </a-card>
                </div>

                <div class="packet-tree-view">
                    <a-card title="报文结构树" class="tree-view-card">
                        <a-tree
                            v-if="parsedTreeData.length > 0"
                            :tree-data="parsedTreeData"
                            :defaultExpandAll="true"
                            @select="onTreeNodeSelect"
                        ></a-tree>
                        <div v-else class="no-data-message">暂无解析数据</div>
                    </a-card>
                </div>
            </div>
        </div>
        <div v-else class="no-result-message">请输入报文数据并点击"解析报文"按钮开始解析</div>
    </a-card>
</template>

<script setup>
    import ScrollTextarea from '../../components/ScrollTextarea.vue';
    import { ref, reactive, toRaw, watch, onMounted, computed } from 'vue';
    import { message } from 'ant-design-vue';
    import { debounce } from 'lodash-es';
    import { clearValidationErrors } from '../../utils/validationCommon';

    defineOptions({
        name: 'PacketParser'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };
    const hexViewRef = ref(null);

    const validationErrors = ref({
        packetData: ''
    });

    const formState = ref({
        packetType: 'bgp',
        packetData: ''
    });

    const validatePacketData = (value, errors) => {
        if (!value || value.trim() === '') {
            errors.value.packetData = '请输入报文数据';
            return false;
        }

        // 简单验证是否是16进制格式
        const hexPattern = /^[0-9A-Fa-f\s]+$/;
        if (!hexPattern.test(value)) {
            errors.value.packetData = '报文数据必须是16进制格式，例如: FF FF FF FF';
            return false;
        }

        errors.value.packetData = '';
        return true;
    };

    const validateField = (value, field, validator) => {
        return validator(value, validationErrors);
    };

    // 解析结果
    const parsedResult = ref(null);
    const selectedNode = ref(null);
    const parsedTreeData = ref([]);
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
                const rowElement = hexViewRef.value.querySelector(`tbody tr:nth-child(${rowIndex + 1})`);
                if (rowElement) {
                    rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        } else {
            selectedNode.value = null;
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

    // 保存配置
    const saveConfig = debounce(async data => {
        const resp = await window.toolsApi.savePacketParserConfig(data);
        if (resp.status === 'success') {
            console.info(resp.msg);
        } else {
            console.error(resp.msg);
        }
    }, 300);

    const mounted = ref(false);

    watch(
        formState,
        newValue => {
            if (!mounted.value) return;
            const raw = toRaw(newValue);
            saveConfig(raw);
        },
        { deep: true }
    );

    // 处理解析报文
    const handleParsePacket = async () => {
        try {
            // 验证字段
            clearValidationErrors(validationErrors);
            validateField(formState.value.packetData, 'packetData', validatePacketData);

            if (validationErrors.value.packetData) {
                message.error('请检查报文数据是否正确');
                return;
            }

            const payload = {
                packetType: formState.value.packetType,
                packetData: formState.value.packetData
            };

            const resp = await window.toolsApi.parsePacket(payload);

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
            clearValidationErrors(validationErrors);
        }
    });

    onMounted(async () => {
        // 加载保存的配置
        const savedConfig = await window.toolsApi.loadPacketParserConfig();
        if (savedConfig.status === 'success' && savedConfig.data) {
            formState.value = savedConfig.data;
        }

        mounted.value = true;
    });
</script>

<style scoped>
    .packet-parser-card {
        margin-top: 10px;
        margin-left: 8px;
    }

    :deep(.ant-form-item) {
        margin-bottom: 10px;
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

    .packet-result-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .result-row {
        display: flex;
        flex-direction: row;
        gap: 20px;
    }

    .packet-hex-view {
        flex: 3;
        height: 400px;
        overflow: hidden;
    }

    .packet-tree-view {
        flex: 2;
        height: 400px;
        overflow: auto;
    }

    .hex-content {
        font-family: monospace;
        white-space: pre;
        font-size: 12px;
    }

    .hex-table {
        width: 100%;
        border-collapse: collapse;
    }

    .hex-table td {
        padding: 1px 3px;
    }

    .offset-cell {
        color: #666;
        padding-right: 12px;
    }

    .ascii-cell {
        padding-left: 14px;
        color: #444;
    }

    .highlighted {
        background-color: #fff3cd;
        color: #856404;
        font-weight: bold;
    }

    .no-data-message,
    .no-result-message {
        text-align: center;
        padding: 20px;
        color: #999;
    }

    /* 树结构区域字体样式 */
    :deep(.ant-tree) {
        font-size: 12px;
    }
</style>
