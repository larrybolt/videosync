
/*
 * GET home page.
 */

exports.index = function(req, res){
  // check if a session exists, else ask to initate a new session
  if (typeof(req.signedCookies.uid) == 'undefined')
  {
    // redirect user to new session page
    return res.render('new_session');
  }
  else {
    console.log('Existing session: ', req.signedCookies.uid);
    // generate a new uid
    //var uid = Math.floor(Math.random() * Math.pow(10,16)).toString(16);
    //res.cookie('session', uid, { signed: true });
  }
  res.render('index', { title: 'Express' });
};
