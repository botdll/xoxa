<template>
  <q-page class="constrain q-pa-md">

    <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="showNotificationsBanner && pushNotificationsSupported" class="banner-container bg-primary">
        <div class="constrain">
          <q-banner class="bg-grey-3 text-primary q-mb-md">
            <template v-slot:avatar>
              <q-icon name="fas fa-bell" color="primary"/>
            </template>

            Would you like to enable notifications?

            <template v-slot:action>
              <q-btn @click="enableNotifications" class="q-px-sm" label="Yes" color="primary" dense flat />
              <q-btn @click="showNotificationsBanner = false" class="q-px-sm" label="Later" color="primary" dense flat />
              <q-btn @click="neverShowNotificationsBanner" class="q-px-sm" label="Never" color="primary" dense flat />
            </template>
          </q-banner>
        </div>
      </div>
    </transition>

    <div class="row q-col-gutter-lg">

      <div class="col-12">
        <template v-if="!loadingPosts && posts.length">
          <q-card
            v-for="post in posts"
            :key="post.id"
            class="my-card q-mb-md"
            :class="{ 'bg-red-1':post.offline }"
            bordered
            flat
          >
            <q-badge
              v-if="post.offline"
              class="absolute-top-right badge-offline"
              color="red"
            >
              Stored offline
            </q-badge>

            <q-item>

              <!-- <q-item-section avatar>
                <q-avatar>
                  <img src="https://cdn.quasar.dev/img/boy-avatar.png">
                </q-avatar>
              </q-item-section> -->

              <q-item-section>
                <q-item-label class="text-bold">{{ post.nickname }}</q-item-label>
                <q-item-label caption>
                  {{ post.location }}
                </q-item-label>
              </q-item-section>

            </q-item>

            <q-separator />

            <q-img :src="post.imageUrl" :ratio="4/3"/>

            <q-card-section>
              <div>{{ post.message }}</div>
              <div class="text-caption text-grey">{{ post.date | beutifyDate }}</div>
            </q-card-section>

          </q-card>
        </template>
        <template v-else-if="!loadingPosts && !posts.length">
          <h5 class="text-center text-gray">No posts yet!!!</h5>
        </template>
        <template v-else>
          <q-card flat bordered>
            <q-item>
              <!-- <q-item-section avatar>
                <q-skeleton type="QAvatar" animation="fade" size="40px"/>
              </q-item-section> -->

              <q-item-section>
                <q-item-label>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
                <q-item-label caption>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-skeleton height="200px" square animation="fade" />

            <q-card-section>
              <q-skeleton type="text" class="text-subtitle2" animation="fade" />
              <q-skeleton type="text" width="50%" class="text-subtitle2" animation="fade" />
            </q-card-section>
          </q-card>
        </template>
      </div>

      <!-- <div class="col-4 large-screen-only">
        <q-item class="fixed">

          <q-item-section avatar>
            <q-avatar size="48px">
              <img src="https://cdn.quasar.dev/img/boy-avatar.png">
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-bold">george_ts</q-item-label>
            <q-item-label caption>
              george
            </q-item-label>
          </q-item-section>

        </q-item>
      </div> -->

    </div>
  </q-page>
</template>

<script>
import { date } from 'quasar'
import { openDB } from 'idb'
const qs = require('qs')

export default {
  name: 'PageHome',
  data() {
    return {
      posts: [],
      loadingPosts: false,
      showNotificationsBanner: false
    }
  },
  methods: {
    getPosts() {
      this.loadingPosts = true

      // IE fix getposts issue due to caching behavior
      let timestamp = ''
      if (this.$q.platform.is.ie) {
        timestamp = `?timestamp=${Date.now()}`
      }

      this.$axios.get(`${process.env.API}/posts${timestamp}`).then(res => {
        this.posts = res.data
        this.loadingPosts = false
        if (!navigator.onLine) {
          this.getOfflinePosts()
        }
      }).catch(e => {
        this.$q.dialog({
          title: 'Error',
          message: 'Could not download posts'
        })
        this.loadingPosts = false
      })
    },
    getOfflinePosts() {
      let db = openDB('workbox-background-sync').then(db => {
        db.getAll('requests').then(failedRequests => {
          failedRequests.forEach(failedRequest => {
            if (failedRequest.queueName === 'createPostQueue') {
              let request = new Request(failedRequest.requestData.url, failedRequest.requestData)
              request.formData().then(formData => {
                let offlinePost = {}
                offlinePost.id = formData.get('id')
                offlinePost.nickname = formData.get('nickname')
                offlinePost.message = formData.get('message')
                offlinePost.location = formData.get('location')
                offlinePost.date = parseInt(formData.get('date'))
                offlinePost.offline = true

                let reader = new FileReader()
                reader.readAsDataURL(formData.get('file'))
                reader.onloadend = () => {
                  offlinePost.imageUrl = reader.result
                  this.posts.unshift(offlinePost)
                }
              })
            }
          })
        }).catch(e => console.error('Error accessing IndexDB: ', e))
      })
    },
    listenForOfflinePostUploaded() {
      if (this.serviceWorkerSupported) {
        const channel = new BroadcastChannel('sw-messages');
        channel.addEventListener('message', event => {
          // console.log('Received', event.data);
          if (event.data.msg === 'offline-post-uploaded') {
            let offlinePostCount = this.posts.filter(post => post.offline === true).length
            this.posts[offlinePostCount - 1].offline = false
          }
        });
      }
    },
    enableNotifications() {
      if (this.pushNotificationsSupported) {
        Notification.requestPermission(result => {
          // console.log('Notifications permission: ', result)
          this.neverShowNotificationsBanner()
          if (result === 'granted') {
            // this.displayGrantedNotification()
            this.checkForExistingPushSubscription()
          }
        })
      }
    },
    checkForExistingPushSubscription() {
      if (this.serviceWorkerSupported && this.pushNotificationsSupported) {
        let register;

        navigator.serviceWorker.ready.then(sw => {
          register = sw
          return sw.pushManager.getSubscription()
        }).then(sub => {
          if (!sub) {
            this.createPushSubscription(register)
          }
        })
      }
    },
    createPushSubscription(register) {
      let vapidPublicKey = 'BDL3sXusplYTR5P1StzKSUJRj7n6sjhxnMc2ShdAyWC85xkSBeC3H2D3Es5RC1O6whjVlFVEDD2DonOKbbIJZhk'
      let vapidPublicKeyConverted = this.urlBase64ToUint8Array(vapidPublicKey)
      register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKeyConverted
      }).then(newSub => {
        let newSubData = newSub.toJSON()
        let newSubDataQS = qs.stringify(newSubData)

        return this.$axios.post(`${process.env.API}/createSubscription?${newSubDataQS}`)
      }).then(response => {
        this.displayGrantedNotification()
      }).catch(e => console.error(e))
    },
    displayGrantedNotification() {
      if (this.serviceWorkerSupported && this.pushNotificationsSupported) {
        navigator.serviceWorker.ready.then(sw => {
          sw.showNotification(`You're subscribed to receive our notifications!`, {
            body: 'Thanks for subscribing!',
            icon: 'icons/icon-128x128.png',
            image: 'icons/icon-128x128.png',
            badge: 'icons/icon-128x128.png',
            dir: 'ltr',
            lang: 'en-US',
            vibrate: [100, 50, 200],
            tag: 'confirm-notification',
            renotify: true
          })
        })
      }
    },
    neverShowNotificationsBanner() {
      this.showNotificationsBanner = false
      this.$q.localStorage.set('neverShowNotificationsBanner', true)
    },
    initNotificationsBanner() {
      let neverShowNotificationsBanner = this.$q.localStorage.getItem('neverShowNotificationsBanner')

      if (!neverShowNotificationsBanner) {
        this.showNotificationsBanner = true
      }
    },
    urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }
  },
  computed: {
    serviceWorkerSupported() {
      if ('serviceWorker' in navigator) return true

      return false
    },
    pushNotificationsSupported() {
      if ('PushManager' in window) return true

      return false
    }
  },
  filters: {
    beutifyDate(timeStamp) {
      return date.formatDate(timeStamp, 'D MMMM YYYY H:mm')
    }
  },
  activated() {
    this.getPosts()
  },
  created() {
    this.listenForOfflinePostUploaded()
    this.initNotificationsBanner()
  }
}
</script>

<style lang="sass">
  .my-card
    .badge-offline
      border-top-left-radius: 0 !important
    .q-img
      min-height: 200px
</style>
