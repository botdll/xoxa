<template>
  <q-page class="constrain-more q-pa-md">
    <div class="camera-frame q-pa-md">
      <!-- <q-responsive :ratio="4/3" class="col"> -->
        <video v-show="!imageCaptured" ref="video" class="full-width" autoplay playsinline />
        <canvas v-show="imageCaptured" ref="canvas" class="full-width" height="240" />
      <!-- </q-responsive> -->

    </div>
    <div class="text-center q-pa-md">
      <q-btn
        v-if="hasCameraSupport"
        @click="captureImage"
        :disable="imageCaptured"
        color="primary"
        icon="fas fa-camera"
        size="lg"
        round
      />
      <q-file
        v-else
        v-model="imageUpload"
        @input="captureImageFallback"
        accept="image/*"
        label="Choose an image"
        outlined
      >
        <template v-slot:prepend>
          <q-icon name="far fa-file-image" class="text-blue-11"/>
        </template>
      </q-file>
      <div class="row justify-center q-ma-md">
        <q-input v-model="post.nickname" label="nickname" class="col col-sm-8" dense/>
      </div>
      <div class="row justify-center q-ma-md">
        <q-input v-model="post.message" label="message" class="col col-sm-8" dense/>
      </div>
      <div class="row justify-center q-ma-md">
        <q-input v-model="post.location" :loading="locationLoading" label="location" class="col col-sm-8" dense>
          <template v-slot:append>
            <q-btn
              v-if="!locationLoading && locationSupported"
              @click="getLocation"
              class="text-blue-11"
              icon="fas fa-location-arrow"
              size="sm"
              dense
              flat
              round
            />
          </template>
        </q-input>
      </div>
      <div class="row justify-center q-mt-lg">
        <q-btn
          :disable="!post.message || !post.photo || !post.nickname"
          @click="addPost()"
          class="q-mb-lg"
          color="primary"
          label="post image"
          rounded
          unelevated
        />
      </div>
    </div>
  </q-page>
</template>

<script>
import { uid } from 'quasar'
require('md-gum-polyfill')

export default {
  name: 'PageCamera',
  data() {
    return {
      post: {
        id: uid(),
        nickname: '',
        message: '',
        location: '',
        photo: null,
        date: Date.now()
      },
      imageCaptured: false,
      hasCameraSupport: true,
      imageUpload: [],
      locationLoading: false
    }
  },
  methods: {
    initCamera() {
      navigator.mediaDevices.getUserMedia({
        video: true
      }).then(stream => {
        this.$refs.video.srcObject = stream
      }).catch(e => this.hasCameraSupport = false)
    },
    captureImage() {
      let video = this.$refs.video
      let canvas = this.$refs.canvas
      canvas.width = video.getBoundingClientRect().width
      canvas.height = video.getBoundingClientRect().height
      let context = canvas.getContext('2d')

      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      this.imageCaptured = true
      this.post.photo = this.dataURItoBlob(canvas.toDataURL())
      this.disableCamera()
    },
    dataURItoBlob(dataURI) {
      let byteString = atob(dataURI.split(',')[1])
      let mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
      let ab = new ArrayBuffer(byteString.length)
      let ia = new Uint8Array(ab)

      for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i)
      }

      let blob = new Blob([ab], {type: mimeString})

      return blob
    },
    captureImageFallback(file) {
      this.post.photo = file
      let canvas = this.$refs.canvas
      let context = canvas.getContext('2d')

      let reader = new FileReader()
      reader.onload = event => {
        let img = new Image()
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          context.drawImage(img, 0, 0)
          this.imageCaptured = true
        }
      img.src = event.target.result
      }
      reader.readAsDataURL(file)  
    },
    disableCamera() {
      this.$refs.video.srcObject.getVideoTracks().forEach(track => track.stop())
    },
    getLocation() {
      this.locationLoading = true

      navigator.geolocation.getCurrentPosition(
        position => this.getCityAndCountry(position),
        e => this.locationError(),
        {timeout: 7000})
    },
    getCityAndCountry(position) {
      let apiUrl = `https://geocode.xyz/${position.coords.latitude},${position.coords.longitude}?json=1`

      this.$axios.get(apiUrl).then(result => this.locationSuccess(result)).catch(e => this.locationError())
    },
    locationSuccess(result) {
      let currentCity = result.data.geocode
      let city = () => currentCity.split('-')[0]
      this.post.location = city()

      if (result.data.country) {
        this.post.location += `, ${result.data.country}`
      }

      this.locationLoading = false
    },
    locationError() {
      let locationErrorMsg = 'Could not find your location.'
      if (this.$q.platform.is.mac) {
        locationErrorMsg += ' You might be able to fix this in System Preferences -> Security & Privacy -> Location Services'
      }

      this.$q.dialog({
        title: 'Error',
        message: locationErrorMsg
      })

      this.locationLoading = false
    },
    addPostError() {
      this.$q.dialog({
        title: 'Error',
        message: 'Sorry, post could not be created!'
      })
    },
    addPost() {
      this.$q.loading.show()

      let postCreated = this.$q.localStorage.getItem('postCreated')

      // Background sync fix to warn user when new post was created for the first time on android
      if (this.$q.platform.is.android && !postCreated && !navigator.onLine) {
        this.addPostError()
        this.$q.loading.hide()
      } else {
      let formData = new FormData()
      formData.append('id', this.post.id)
      formData.append('nickname', this.post.nickname)
      formData.append('message', this.post.message)
      formData.append('location', this.post.location)
      formData.append('date', this.post.date)
      formData.append('file', this.post.photo, `${this.post.id}.png`)

      this.$axios.post(`${process.env.API}/createPost`, formData)
        .then(res => {
          // console.log(res)
          this.$q.localStorage.set('postCreated', true)
          this.$router.push('/')
          this.$q.notify({
            message: 'Post created!',
            color: 'primary',
            actions: [
              { label: 'Dismiss', color: 'white'}
            ]
          })
          this.$q.loading.hide()
          // Fix caching issue with Safari
          if (this.$q.platform.is.safari) {
            setTimeout(() => {
              window.location.href = '/'
            }, 1000)
          }
        })
        .catch(e => {
          // console.log(e)
          if (!navigator.onLine && this.backgroundSyncSupported && postCreated) {
            // Redirect to home page if user is offline and post registered to sw
            this.$q.notify('Post created offline')
            this.$router.push('/')
          } else {
            this.addPostError()
          }
          this.$q.loading.hide()
        })
      }
    }
  },
  computed: {
    locationSupported() {
      if ('geolocation' in navigator) return true

      return false
    },
    backgroundSyncSupported() {
      if ('serviceWorker' in navigator && 'SyncManager' in window) return true

      return false
    }
  },
  mounted() {
    this.initCamera()
  },
  beforeDestroy() {
    if (this.hasCameraSupport) {
      this.disableCamera()
    }
  }
}
</script>

<style lang="sass">
  .camera-frame
    border: 2px solid $blue-11
    border-radius: 10px
</style>
