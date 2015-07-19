var http = require('http');
var path = require('path');
var express = require('express');
var mongoose = require('mongoose');
var passport = require('passport');
var util = require('util');
var GitHubStrategy = require('passport-github').Strategy;
var GITHUB_CLIENT_ID = "d1527f0d319039232e2e";
var GITHUB_CLIENT_SECRET = "ed8e95d75cc80f65c6a84e7963c8f006333a3230";
var router = express();
var bodyParser = require('body-parser');
var server = http.createServer(router);
var methodOverride = require('method-override');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var session = require("express-session");
mongoose.connect('mongodb://localhost/musicbox');
router.use(bodyParser.json());


var myIP = process.env.IP || "0.0.0.0";
var myPORT = process.env.PORT || 3000;

var curruser;

var userSchema = new mongoose.Schema({
  username: {type: String, required: true, unique: true},
  name: String,
  friends: {type: Array},
  sent: {type: Array},
  recieved: {type: Array}
});

var postSchema = new mongoose.Schema({
  username: {type: String, required: true},
  message: String,
  track: String,
  playlist: String,
  time: {type: Date, default: Date.now}
});

var trackSchema = new mongoose.Schema({
  track: {type:String, required: true},
  artist: {type:String, required: true},
  genre: String
});

var playlistSchema = new mongoose.Schema({
  title: {type:String, required: true},
  creator: {type:String, required: true},
  tracks: {type:Array, required:true}
});

var User = mongoose.model('User', userSchema);
var Post = mongoose.model('Post', postSchema);
var Track = mongoose.model('Track', trackSchema);
var Playlist = mongoose.model('Playlist', playlistSchema);

// var newPlaylist = new Playlist({title:"Best Playlist Evah", creator:"nlane", tracks:["55abf055321611ff73929bde","55abf055321611ff73929bdf"]});
//           newPlaylist.save(function(err, track){
//             if(err){
//               console.log("error: ", err);
//             }
//             else{
//               console.log(track);
//             }
//           });
          
// var newTrack2 = new Track({track:"Budapest", artist:"George Ezra"});
//           newTrack2.save(function(err, track){
//             if(err){
//               console.log("error: ", err);
//             }
//             else{
//               console.log(track);
//             }
//           });

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete GitHub profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "https://music-box-nlane.c9.io/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      var uname = profile.username;
      User.find({username:uname}).exec(function(err, documents){
        if(documents.length != 0){
          curruser = uname;
        }
        else{
          var newUser = new User({username:uname, name:profile.displayName});
          curruser = uname;
          newUser.save(function(err, user){
            if(err){
              console.log("error: ", err);
            }
            else{
              console.log(user);
            }
          });
        }
      });
            
      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical routerlication, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));


router.set('views', __dirname + '/views');
  router.set('view engine', 'ejs');
  router.use(morgan());
  router.use(cookieParser());
  router.use(bodyParser());
  router.use(methodOverride());
  router.use(session({ secret: 'keyboard cat' }));
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  router.use(passport.initialize());
  router.use(passport.session());

router.get('/', function(req, res){
  res.render('index', { user: req.user})
});

router.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

router.get('/login', function(req, res){
  res.render('login', { user: req.user });
});


// GET /auth/github
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in GitHub authentication will involve redirecting
//   the user to github.com.  After authorization, GitHubwill redirect the user
//   back to this routerlication at /auth/github/callback
router.get('/auth/github',
  passport.authenticate('github'),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  });

// GET /auth/github/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

router.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});


var server = http.createServer(router);
server.listen(myPORT, myIP);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}

// returns this user's document
router.get('/api/info', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  else{
   User.find({username:req.user.username}).exec(function(err, documents){
    res.json(documents);
  });
  }
})

//returns this user's posts
router.get('/api/posts', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  else{
    Post.aggregate({$sort:{time:-1}}, {$match:{username:req.user.username}}).exec(function(err, docs){
      res.json(docs);
    })
  }
});

//returns newsfeed of friends posts
router.get('/api/home', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  else{
   User.find({username:req.user.username}, {friends:1, _id:0}).exec(function(err, documents){
      var friendarray = documents;
      var fnds = friendarray[0].friends;
      Post.aggregate({$sort:{time:-1}}, {$match:{username:{$in:fnds}}}).exec(function(err, docs){
        res.json(docs);
      })
   });
  }
})

//will add each other to friend's array
router.put('/api/friend', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  else{
    User.find({username:req.body.user}).exec(function(err, documents){
      if(documents.length != 0){
        User.update({username:req.user.username}, {$push:{friends:req.body.user}}).exec(function(err, documents){
          User.update({username:req.body.user}, {$push:{friends:req.user.username}}).exec(function(err, documents){
              res.send("You now are friends with: " + req.body.user);
          });
        });
      }
      else{
        res.send("Please enter a valid username");
      }
    });
  }
})

//creates new post
router.post('/api/new-post', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  if(req.body.track != undefined){
    Post.create({username:req.user.username, message:req.body.message, track:req.body.track})
    res.send("Post created!");
  }
  else if (req.body.playlist != undefined){
    Post.create({username:req.user.username, message:req.body.message, playlist:req.body.playlist})
    res.send("Post created!");
  }
  else {
    res.send("Please enter either a track or playlist");
  }
})

//deletes post given the posts id
router.delete('/api/post', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  else{
    Post.findByIdAndRemove(req.body.id, function(err, docs){
      if(!err){
          res.send("Post removed!");
      }
        else{
          res.send("Please enter a valid post id");
        }
      })
  }
});

//deletes user given the username
// router.delete('/user', function(req, res){
//   if(!req.isAuthenticated()){
//     res.redirect('/login');
//   }
//   else{
//     User.findByIdAndRemove(req.body.userid, function(err, docs){
//         if(!err){
//           req.logout;
//           res.send("User deleted :( bye");
//         }
//         else{
//           res.send("Please enter a valid userid");
//         }
//       })
//   }
// });

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Server listening at", addr.address + ":" + addr.port);
});
