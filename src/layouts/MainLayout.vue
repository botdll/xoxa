<template>
  <q-layout view="lHh Lpr lFf">

    <q-header  class="bg-white text-blue-7" bordered>
      <q-toolbar class="constrain">
        <q-btn
          color="primary"
          icon="fas fa-camera-retro"
          size="16px"
          to="/camera"
          class="large-screen-only q-mr-sm"
          dense
          flat
          round
        />
        <q-separator class="large-screen-only" vertical spaced/>
        <q-toolbar-title class="text-bold my-font">
          xoxa
        </q-toolbar-title>
        <q-btn
          color="primary"
          icon="fas fa-home"
          size="16px"
          to="/"
          class="large-screen-only"
          dense
          flat
          round
        />
      </q-toolbar>
    </q-header>

    <q-footer class="bg-white" bordered>

      <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
        <div v-if="showAppInstallBanner" class="banner-container bg-primary">
          <div class="constrain">
            <q-banner class="bg-primary text-white" inline-actions dense>
              <template v-slot:avatar>
                <q-avatar color="white" text-color="blue-7" icon="fas fa-camera-retro" font-size="20px"/>
              </template>

              <strong>Install Xoxa?</strong>

              <template v-slot:action>
                <q-btn @click="installApp" class="q-px-sm" label="Yes" dense flat />
                <q-btn @click="showAppInstallBanner = false" class="q-px-sm" label="Later" dense flat />
                <q-btn @click="neverShowAppInstallBanner" class="q-px-sm" label="Never" dense flat />
              </template>
            </q-banner>
          </div>
        </div>
      </transition>

      <q-tabs class="text-blue-11 small-screen-only" active-color="primary" indicator-color="transparent">
        <q-route-tab to="/" icon="fas fa-home"/>
        <q-route-tab to="/camera" icon="fas fa-camera-retro"/>
      </q-tabs>

    </q-footer>

    <q-page-container class="bg-grey-1">
      <keep-alive :include="['PageHome']">
        <router-view />
      </keep-alive>
    </q-page-container>

  </q-layout>
</template>

<script>
let deferredPrompt;

export default {
  name: 'MainLayout',
  data () {
    return {
      showAppInstallBanner: false
    }
  },
  methods: {
    installApp() {
      // Hide the app provided install promotion
      this.showAppInstallBanner = false
      // Show the install prompt
      deferredPrompt.prompt()
      // Wait for the user to respond to the prompt
      deferredPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt')
          this.neverShowAppInstallBanner()
        } else {
          console.log('User dismissed the install prompt')
        }
      })      
    },
    neverShowAppInstallBanner() {
      this.showAppInstallBanner = false
      this.$q.localStorage.set('neverShowAppInstallBanner', true)
    }
  },
  mounted() {
    let neverShowAppInstallBanner = this.$q.localStorage.getItem('neverShowAppInstallBanner')

    if (!neverShowAppInstallBanner) {
      window.addEventListener('beforeinstallprompt', e => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault()
        // Stash the event so it can be triggered later.
        deferredPrompt = e
        // Update UI notify the user they can install the PWA
        setTimeout(() => {
          this.showAppInstallBanner = true
        }, 3000)        
      })
    }
  }
}
</script>

<style lang="sass">
  .q-toolbar
    @media (min-width: $breakpoint-sm-min)
      height: 80px

  .q-toolbar__title    
    font-size: 30px
    @media (max-width: $breakpoint-xs-max)
      text-align: center

  .q-footer
    .q-tab__icon
      font-size: 30px

  .platform-ios
    .q-footer
      padding-bottom: constant(safe-area-inset-bottom)
      padding-bottom: env(safe-area-inset-bottom)
</style>
