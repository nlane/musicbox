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
router.use(express.static(path.resolve('./views')));

var myIP = process.env.IP || "0.0.0.0";
var myPORT = process.env.PORT || 3000;

var curruser;

var userSchema = new mongoose.Schema({
  username: {type: String, required: true, unique: true},
  name: String,
  friends: {type: Array},
  sent: {type: Array},
  received: {type: Array}
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

router.get('/home', function(req, res){
  res.sendFile(path.resolve('./views/home.html'));
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
   User.find({username:req.user.username}, {sent:0, received:0}).exec(function(err, documents){
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

//returns this user's playlists
router.get('/api/playlists', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  else{
   Playlist.find({creator:req.user.username}).exec(function(err, documents){
      res.json(documents);
   });
  }
})

//returns this user's sent playlists
router.get('/api/sent', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  else{
   User.find({username:req.user.username}, {sent:1, _id:0}).exec(function(err, documents){
      res.json(documents);
   });
  }
})

//returns this user's received playlists
router.get('/api/received', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  else{
   User.find({username:req.user.username}, {received:1, _id:0}).exec(function(err, documents){
      res.json(documents);
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
            if(!err){
              res.send("You now are friends with: " + req.body.user);
            }
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


router.post('/api/new-playlist', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  Playlist.create({creator:req.user.username, title:req.body.title, tracks:req.body.tracks}, function(err, documents){
    if(!err){
      res.send("Playlist created!");
    }
    else{
      res.send("Error :(")
    }
  });
})

//send playlist
router.put('api/send-playlist', function(req, res){
  if(!req.isAuthenticated()){
    res.redirect('/login');
  }
  User.update({username:req.user.username}, {$push:{sent:req.body.playlist}}).exec(function(err, docs){
    User.update({username:req.body.recipient}, {$push:{received:req.body.playlist}}).exec(function(err, docs){
      if(!err){
        res.send("Playlist sent!");
      }
      else{
        res.send("error :(");
      }  
    });
  });
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
