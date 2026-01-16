<template>
    <a-card title="实时流量统计 (KB/s)" class="mt-margin-top-10">
        <template #extra>
            <a-tag color="blue">每2秒更新</a-tag>
        </template>
        <div v-if="isSupported" class="stats-container">
            <div ref="chartRef" class="traffic-chart" />
        </div>
        <div v-else class="unsupported-container">
            <a-empty :description="supportMessage">
                <template #image>
                    <InfoCircleOutlined style="font-size: 48px; color: #faad14" />
                </template>
            </a-empty>
        </div>
    </a-card>
</template>

<script setup>
    import { ref, onUnmounted, onMounted, nextTick } from 'vue';
    import { InfoCircleOutlined } from '@ant-design/icons-vue';
    import * as echarts from 'echarts';

    const chartRef = ref(null);
    let chart = null;
    let timer = null;
    let resizeObserver = null;

    const isSupported = ref(true);
    const supportMessage = ref('');

    // 数据存储：{ 'Adapter Name': { rx: [], tx: [], timestamps: [] } }
    const trafficData = ref({});
    const MAX_DATA_POINTS = 30; // 显示最近 60 秒 (2秒一个点)
    const lastRawStats = ref({}); // 用于计算差值

    const initChart = () => {
        if (!chartRef.value) return;
        chart = echarts.init(chartRef.value);

        // 使用 ResizeObserver 监听容器大小变化，这比监听 window resize 更鲁棒
        resizeObserver = new ResizeObserver(() => {
            if (chart) {
                chart.resize({
                    width: 'auto',
                    height: 'auto'
                });
            }
        });
        resizeObserver.observe(chartRef.value);

        const option = {
            tooltip: {
                trigger: 'axis',
                formatter: params => {
                    let res = params[0].name + '<br/>';
                    params.forEach(item => {
                        res += `${item.marker} ${item.seriesName}: ${item.value.toFixed(2)} KB/s<br/>`;
                    });
                    return res;
                }
            },
            legend: {
                data: [],
                type: 'scroll',
                bottom: 0
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '10%',
                top: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: []
            },
            yAxis: {
                type: 'value',
                name: 'KB/s'
            },
            series: []
        };
        chart.setOption(option);
    };

    const updateStats = async () => {
        if (!window.nativeApi || !window.nativeApi.getTrafficStats) return;

        const res = await window.nativeApi.getTrafficStats();
        if (res.status === 'success') {
            isSupported.value = true;
            const now = new Date().toLocaleTimeString();
            const stats = res.data;

            stats.forEach(item => {
                if (!trafficData.value[item.name]) {
                    trafficData.value[item.name] = { rx: [], tx: [], timestamps: [] };
                }

                const last = lastRawStats.value[item.name];
                if (last) {
                    // 计算 KB/s (2秒间隔)
                    const rxDiff = (item.rxBytes - last.rxBytes) / 1024 / 2;
                    const txDiff = (item.txBytes - last.txBytes) / 1024 / 2;

                    trafficData.value[item.name].rx.push(Math.max(0, rxDiff));
                    trafficData.value[item.name].tx.push(Math.max(0, txDiff));
                    trafficData.value[item.name].timestamps.push(now);

                    if (trafficData.value[item.name].rx.length > MAX_DATA_POINTS) {
                        trafficData.value[item.name].rx.shift();
                        trafficData.value[item.name].tx.shift();
                        trafficData.value[item.name].timestamps.shift();
                    }
                }

                lastRawStats.value[item.name] = { rxBytes: item.rxBytes, txBytes: item.txBytes };
            });

            updateChart();
        } else {
            isSupported.value = false;
            supportMessage.value = res.msg || '当前环境不支持流量统计';
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }
    };

    const updateChart = () => {
        if (!chart) return;

        const series = [];
        const legendData = [];
        let commonTimestamps = [];

        Object.keys(trafficData.value).forEach(name => {
            const data = trafficData.value[name];
            if (data.timestamps.length > 0) {
                commonTimestamps = data.timestamps;

                const rxName = `${name} (RX)`;
                const txName = `${name} (TX)`;

                legendData.push(rxName);
                series.push({
                    name: rxName,
                    type: 'line',
                    data: [...data.rx],
                    smooth: true,
                    showSymbol: false
                });

                legendData.push(txName);
                series.push({
                    name: txName,
                    type: 'line',
                    data: [...data.tx],
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { type: 'dashed' }
                });
            }
        });

        chart.setOption({
            legend: { data: legendData },
            xAxis: { data: commonTimestamps },
            series: series
        });
    };

    onMounted(async () => {
        await nextTick();
        initChart();
        timer = setInterval(updateStats, 2000);
        updateStats(); // 立即执行一次
    });

    onUnmounted(() => {
        if (timer) clearInterval(timer);
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        if (chart) chart.dispose();
    });
</script>

<style scoped>
    .stats-container {
        width: 100%;
        height: 300px;
        display: flex;
        flex-direction: column;
        overflow: hidden; /* 防止 ECharts 导致的横向滚动条 */
    }

    .traffic-chart {
        flex: 1;
        width: 100%;
        height: 100%;
    }

    .unsupported-container {
        height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
