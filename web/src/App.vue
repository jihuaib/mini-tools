<template>
    <div class="app-container">
        <Header />
        <Hero />
        <Features />
        <Footer />
    </div>
</template>

<script setup>
    import Header from './components/Header.vue';
    import Hero from './components/Hero.vue';
    import Features from './components/Features.vue';
    import Footer from './components/Footer.vue';
    import './style.css';
</script>

<style>
    /* Global resets handled in style.css */
    .app-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }
</style>
