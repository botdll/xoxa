const functions = require('firebase-functions')
const admin = require('firebase-admin')
const inspect = require('util').inspect
const Busboy = require('busboy')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const webpush = require('web-push')

// firebase configuration
admin.initializeApp({
  // credential: admin.credential.cert(serviceAccount),
  storageBucket: "xoxa-2677f.appspot.com"
})

const db = admin.firestore()
const bucket = admin.storage().bucket()

// web-push configuration
webpush.setVapidDetails(
  'mailto:test@test.com',
  'BDL3sXusplYTR5P1StzKSUJRj7n6sjhxnMc2ShdAyWC85xkSBeC3H2D3Es5RC1O6whjVlFVEDD2DonOKbbIJZhk', // public key
  'fJaCPU18-MQRtuuK92jPxu71DAKzdKLxY7KUiwYEhMU' // private key
);


// Retrieve posts from Firebase Firestore endpoint
exports.posts = functions.https.onRequest((request, response) => {
  response.set('Access-Control-Allow-Origin', '*')

  let posts = []

  db.collection('posts').orderBy('date', 'desc').get().then(snapshot => {
    snapshot.forEach(doc => {
        posts.push(doc.data())
    })
    
    response.send(posts)
  }) 
})

// Create posts endpoint
exports.createPost = functions.https.onRequest((request, response) => {
  response.set('Access-Control-Allow-Origin', '*')

  let uuid = uuidv4()
  let busboy = new Busboy({ headers: request.headers })

  let fields = {}
  let fileData = {}
  let imageUrl

  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    // console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype)
    let filepath = path.join(os.tmpdir(), filename)
    file.pipe(fs.createWriteStream(filepath))
    fileData = { filepath, mimetype }
  })

  busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
    fields[fieldname] = val
  })

  busboy.on('finish', function() {
    bucket.upload(
      fileData.filepath,
      {
        uploadType: 'media',
        metadata: {
          metadata: {
            contentType: fileData.mimetype,
            firebaseStorageDownloadTokens: uuid
          }
        }
      },
      (err, uploadedFile) => {
        if (!err) {
          createDocument(uploadedFile)
        }
      }
    )

    function createDocument(uploadedFile) {
      imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${uploadedFile.name}?alt=media&token=${uuid}`

      db.collection('posts').doc(fields.id).set({
        id: fields.id,
        nickname: fields.nickname,
        message: fields.message,
        location: fields.location,
        date: parseInt(fields.date),
        imageUrl 
      }).then(() => {
        sendPushNotification()
        response.send('post added: ' + fields.id)
      })
    }

    function sendPushNotification() {
      let subscriptions = []

      db.collection('subscriptions').get().then(snapshot => {
        snapshot.forEach(doc => {
            subscriptions.push(doc.data())
        })
        
        return subscriptions
      }).then(subscriptions => {
        subscriptions.forEach(subscription => {
          // Check if user is using google services/chrome to avoid error and/or charges from google cloud functions
          if (subscription.endpoint.startsWith('https://fcm.googleapis.com')) {
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.keys.auth,
                p256dh: subscription.keys.p256dh
              }
            }
            
            let pushContent = {
              title: 'New Xoxa post!',
              body: 'New post added! Check it out!',
              openUrl: '/#/',
              imageUrl
            }
  
            let pushContentStringified = JSON.stringify(pushContent)
  
            webpush.sendNotification(pushSubscription, pushContentStringified)
          }
        })
      }) 
    }
  })

  busboy.end(request.rawBody)
})

// Create user subscription endpoint
exports.createSubscription = functions.https.onRequest((request, response) => {
  response.set('Access-Control-Allow-Origin', '*')

  db.collection('subscriptions').add(request.query).then(docRef => {
    response.send({
      message: 'Subscription added!',
      postData: request.query
    })
  })
})
