<template>
    <a-card title="报文解析器" class="packet-parser-card">
        <div class="packet-parser-container">
            <!-- 表单区域（放在最上面） -->
            <div class="parser-form-section">
                <a-form :model="formState" :label-col="labelCol" :wrapper-col="wrapperCol" @finish="handleParsePacket">
                    <!-- 报文类型选择 -->
                    <a-form-item label="报文类型" name="packetType">
                        <a-select v-model:value="formState.packetType">
                            <a-select-option value="auto">自动识别</a-select-option>
                            <a-select-option value="ethernet">以太网</a-select-option>
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
                                placeholder="请输入16进制格式的报文内容, 如: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF 00 13 01"
                                :status="validationErrors.packetData ? 'error' : ''"
                                @blur="e => validateField(e.target.value, 'packetData', validateInputPacketData)"
                            />
                        </a-tooltip>
                    </a-form-item>

                    <!-- 操作按钮 -->
                    <a-form-item :wrapper-col="{ span: 24 }">
                        <div class="form-buttons">
                            <a-button type="primary" html-type="submit">解析报文</a-button>
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
                                >
                                    {{ byte }}
                                </div>
                            </div>
                            <div class="ascii-col">
                                <div
                                    v-for="(byte, byteIndex) in row"
                                    :key="byteIndex"
                                    :class="getAsciiCellClass(rowIndex * 16 + byteIndex)"
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
                        :tree-data="parsedTreeData"
                        :default-expand-all="true"
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
</template>

<script setup>
    import ScrollTextarea from '../../components/ScrollTextarea.vue';
    import { ref, toRaw, watch, onMounted, computed } from 'vue';
    import { message } from 'ant-design-vue';
    import { debounce } from 'lodash-es';
    import { clearValidationErrors } from '../../utils/validationCommon';
    import { validateInputPacketData } from '../../utils/toolsValidation';

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

    const getByteCellClass = byteIndex => {
        return {
            'hex-byte': true,
            highlighted: isHighlighted(byteIndex)
        };
    };

    const getAsciiCellClass = byteIndex => {
        return {
            'ascii-byte': true,
            highlighted: isHighlighted(byteIndex)
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
            console.log(resp.msg);
        } else {
            console.error(resp.msg);
        }
    }, 300);

    const mounted = ref(false);

    watch(
        formState,
        newValue => {
            if (!mounted.value) return;

            try {
                clearValidationErrors(validationErrors);
                validateField(formState.value.packetData, 'packetData', validateInputPacketData);

                const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

                if (hasErrors) {
                    console.log('Validation failed, configuration not saved');
                    return;
                }

                const raw = toRaw(newValue);
                saveConfig(raw);
            } catch (error) {
                console.error(error);
            }
        },
        { deep: true }
    );

    // 处理解析报文
    const handleParsePacket = async () => {
        try {
            // 验证字段
            clearValidationErrors(validationErrors);
            validateField(formState.value.packetData, 'packetData', validateInputPacketData);

            if (validationErrors.value.packetData) {
                message.error('请检查报文数据是否正确');
                return;
            }

            const payload = {
                packetType: formState.value.packetType,
                packetData: formState.value.packetData
            };

            let resp;

            // 根据报文类型选择不同的解析方法
            resp = await window.toolsApi.parsePacket(payload);

            console.log(resp);

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

    :deep(.ant-card-body) {
        padding: 12px;
        flex: 1;
        overflow: auto;
        height: calc(100% - 56px);
        display: flex;
        flex-direction: column;
    }

    :deep(.ant-card-head) {
        padding: 0 12px;
        min-height: 40px;
    }

    :deep(.ant-card-head-title) {
        padding: 10px 0;
    }

    :deep(.ant-form-item) {
        margin-bottom: 16px;
    }

    .form-buttons {
        display: flex;
        justify-content: center;
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
        background-color: #fff3cd;
        color: #856404;
        font-weight: bold;
        border-radius: 2px;
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

    @media (max-width: 768px) {
        .parser-result-section {
            flex-direction: column;
        }

        .hex-view-card,
        .tree-view-card {
            width: 100%;
        }
    }
</style>
