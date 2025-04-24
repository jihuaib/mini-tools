<template>
    <div class="bgp-send-route-container">
        <h3>发送路由</h3>
        <!-- Your route sending interface here -->
    </div>
</template>

<script setup>
    import { ref } from 'vue';

    defineOptions({
        name: 'BgpSendRoute'
    });

    // Expose clearValidationErrors method to parent component
    defineExpose({
        clearValidationErrors: () => {
            // Implementation here if needed
        }
    });
</script>

<style scoped>
    .bgp-send-route-container {
        padding: 10px;
    }
</style>
