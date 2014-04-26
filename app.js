/**
 * Module dependencies.
 */

express = require('express')
  , connect = require('connect')
  , cookie = require('cookie')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path');
var app = express();
var codein = require("node-codein");

// it sucks that express doesn't share session-data with socketio
// or at least not when I started building this
// oh well.. this fixed it
var cookie_secret = 'your secret here';

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser(cookie_secret));
  app.use(express.session());
  app.use(app.router);
  app.use(require('less-middleware')(path.join(__dirname, '/public')));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// Users collection
var users = [];
/*    [
        {name: 'user1', session: '1'}, 
        {name: 'user2', session: '2'}, 
        {name: 'user3', session: '3'}
    ];
*/

// Current user
var me = false;
app.locals.me = false;

// Session collection
var streams = {};
/*    {
 *      'id': {url: 'http://url'},
 *      'id': {url: 'http://url'}
 *    }
 */

function check_session(req, res, next)
{
  // check if a session exists, else ask to initate a new session
  if (typeof(req.signedCookies.session) == 'undefined')
  {
    // redirect user to new session page
    return res.redirect('/auth?ref='+req.path);
  }
  else {
    me = get_user(req.signedCookies.session);
    if (me == false)
    {
      // cookie is invalid
      res.clearCookie('session');
      return res.redirect('/auth?ref='+req.path);
    }
    res.locals.me = me;
    next();
 }
}
function user_exists (username){
    for (var i = 0; i < users.length; i++){
        if (users[i].name == username) return true;
    }
    return false;
}
function get_user (sessionid)
{
  for (var i = 0; i < users.length; i++){
    if (users[i].session == sessionid)
      return users[i];
  }
  return false;
}

app.get('/', check_session, function (req, res, next){
  res.render('index');
});

app.post('/', check_session, function (req, res, next){
  var streamid = Math.floor(Math.random() * Math.pow(10,16)).toString(16);
  streams[streamid] = { url: req.body.url, master: me.session, seek: 0, state: false };
  res.redirect('/watch/'+streamid);
});

app.get('/watch/:streamid', check_session, function (req, res, next){
  if (typeof streams[req.params.streamid] == 'undefined')
    return res.send(404, 'Sorry, we cannot find that!');

  res.render('watch', { url: streams[req.params.streamid].url });
});

app.get('/auth', function(req, res){
  res.render('new_session');
});

app.get('/streams', function(req, res){
  res.render('streams', { streams: streams });
});

app.post('/auth', function(req, res){
  // strip tags from request
  var name = req.body.name.replace(/<(?:.|\n)*?>/gm, '');

  // check if length > 0
  if (name.length == 0)
    return res.render('new_session', { error: 'Please choose a valid username!', name: name });

  // check if the username already is used
  if (user_exists(name))
    return res.render('new_session', { error: 'This name is already in use!', name: name });

  // generate a new uid
  var uid = Math.floor(Math.random() * Math.pow(10,16)).toString(16);
  res.cookie('session', uid, { signed: true });

  // add the user to the users var
  users.push({ 'name': name, session: uid });
 
  if (typeof req.query.ref != 'undefined' && req.query.ref.length > 0)
    res.redirect(req.query.ref);
  else
    res.redirect('/');
});

var server = http.createServer(app).listen(app.get('port'), function(){
 	console.log("Express server listening on port " + app.get('port'));
});

var io = require('socket.io').listen(server);

io.set('authorization', function (data, accept) {

  if (!data.headers.cookie) {
    return accept('No cookie transmitted.', false);
  }

  var cookies = data.headers.cookie;
  try {
    data.cookies = cookie.parse(cookies);
      data.signedCookies = connect.utils.parseSignedCookies(data.cookies, cookie_secret);
      data.signedCookies = connect.utils.parseJSONCookies(data.signedCookies);
    data.cookies = connect.utils.parseJSONCookies(data.cookies);
  } catch (err) {
  }

  if (typeof data.signedCookies.session == 'undefined')
    return accept('No cookie transmitted.', false);

  data.user = get_user(data.signedCookies.session);

  if (data.user == false)
    return accept('No cookie transmitted.', false);

  //data.sessionid = data.signedCookies.session;

  return accept(null, true);
});

io.sockets.on('connection', function (socket){
  var hs = socket.handshake
    , stream
    , me = hs.user;

  socket.on('set streamid', function (streamid)
  {
    stream = streams[streamid];
    if (stream.master == me.session)
      socket.emit('master '+streamid, true);
    else
      socket.emit('player '+streamid, { state: stream.state, seek: stream.seek });

    socket.on('player '+streamid, function (data)
    {
      if (typeof stream.master !== 'undefined' && stream.master == me.session)
        socket.broadcast.emit('player '+streamid, data);
    });
  });
});


