/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.conf > pwa > workboxPluginMode is set to "InjectManifest"
 */


// Dependecies
import {precacheAndRoute} from 'workbox-precaching'
import {registerRoute} from 'workbox-routing'
import {StaleWhileRevalidate} from 'workbox-strategies'
import {CacheFirst} from 'workbox-strategies'
import {ExpirationPlugin} from 'workbox-expiration'
import {CacheableResponsePlugin} from 'workbox-cacheable-response'
import {NetworkFirst} from 'workbox-strategies'
import {Queue} from 'workbox-background-sync'

// Configuration
precacheAndRoute(self.__WB_MANIFEST)

let backgroundSyncSupported = 'sync' in self.registration ? true : false // Checks if Background sync is natively supported.
    
// Queue for creating posts
let createPostQueue = null

if (backgroundSyncSupported) {
    createPostQueue = new Queue('createPostQueue', {
        onSync: async ({queue}) => {
          let entry;
          while (entry = await queue.shiftRequest()) {
            try {
              await fetch(entry.request);
              console.log('Replay successful for request', entry.request);
              const channel = new BroadcastChannel('sw-messages');
              channel.postMessage({msg: 'offline-post-uploaded'});
            } catch (error) {
              console.error('Replay failed for request', entry.request, error);
      
              // Put the entry back in the queue and re-throw the error:
              await queue.unshiftRequest(entry);
              throw error;
            }
          }
          console.log('Replay complete!');
        }
    })
}


/* ## Caching strategies ## */

// Cache First (Cache Falling Back to Network)
registerRoute(
    ({url}) => url.host.startsWith('fonts.g'),
    new CacheFirst({
        cacheName: 'google-fonts',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 30,
            }),
            new CacheableResponsePlugin({
                statuses: [0, 200],
            })
        ],
    })
)

// Network First (Network Falling Back to Cache)
registerRoute(
    ({url}) => url.pathname.startsWith('/posts'),
    new NetworkFirst()
  )

// Stale-While-Revalidate
registerRoute(
    ({url}) => url.pathname.startsWith('/social-timeline/'),
    new NetworkFirst()
  );

registerRoute(
    ({url}) => url.href.startsWith('http'),
    new StaleWhileRevalidate()
)

// Fetch events
if (backgroundSyncSupported) {
    self.addEventListener('fetch', event => {
        if (event.request.url.endsWith('/createPost')) {
            // Clone the request to ensure it's safe to read when
            // adding to the Queue.
            if(!self.navigator.onLine) {
                const promiseChain = fetch(event.request.clone()).catch(err => {
                    return createPostQueue.pushRequest({request: event.request})
                })
                
                event.waitUntil(promiseChain)
            }
        }
    })
}

// Push events
self.addEventListener('push', event => {
    // console.log('push msg received', event)
    if (event.data) {
        let data = JSON.parse(event.data.text())
        event.waitUntil(self.registration.showNotification(
            data.title,
            {
                body: data.body,
                icon: 'icons/icon-128x128.png',
                badge: 'icons/icon-128x128.png',
                data: { openUrl: data.openUrl },
                image: data.imageUrl
            }
        ))
    }
})

// Notifications events
self.addEventListener('notificationclick', event => {
    let notification = event.notification
    let action = event.action

        if (action) {
        event.waitUntil(clients.matchAll().then(client => {
            let clientUsingApp = client.find(c => {
                return c.visibilityState === 'visible'
            })

            if (clientUsingApp) {
                clientUsingApp.navigate(notification.data.openUrl)
                clientUsingApp.focus()
            } else {
                clients.openWindow(notification.data.openUrl)
            }
        }))
    }

    notification.close()
})

// self.addEventListener('notificationclose', event => {
//     console.log('notification closed', event)
// })
