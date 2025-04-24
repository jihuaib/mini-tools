<template>
    <div class="bgp-receive-route-container">
        <h3>接收路由</h3>
        <!-- Your route receiving interface here -->
    </div>
</template>

<script setup>
    import { ref } from 'vue';

    defineOptions({
        name: 'BgpReceiveRoute'
    });

    // Expose clearValidationErrors method to parent component
    defineExpose({
        clearValidationErrors: () => {
            // Implementation here if needed
        }
    });
</script>

<style scoped>
    .bgp-receive-route-container {
        padding: 10px;
    }
</style>
