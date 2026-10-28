<script lang="ts">
  import { onMount } from 'svelte';
  import { session, enterDesktop } from './lib/session.svelte';
  import { settings } from './lib/settings.svelte';
  import { backend } from './lib/backend';
  import Boot from './boot/Boot.svelte';
  import Login from './boot/Login.svelte';
  import Register from './boot/Register.svelte';
  import Desktop from './desktop/Desktop.svelte';
  import TagPopup from './ui/TagPopup.svelte';
  import ConfirmHost from './ui/ConfirmHost.svelte';
  import Lightbox from './ui/Lightbox.svelte';
  onMount(async () => { session.remembered = await backend.restore(); });
  $effect(() => { document.documentElement.classList.toggle('rm', settings.reduceMotion); });
</script>
<div class:scan={settings.scanlines} class="root">
  {#if session.stage === 'boot' || session.stage === 'press'}
    <Boot />
  {:else if session.stage === 'login'}
    <Login />
  {:else if session.stage === 'register'}
    <Register />
  {:else if session.stage === 'desktop' && session.user}
    <Desktop />
    <TagPopup />
  {/if}
  <Lightbox />
  <ConfirmHost />
</div>
<style>.root{position:fixed;inset:0}</style>
