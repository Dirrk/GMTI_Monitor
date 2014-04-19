/**
 * Created by Derek Rada on 4/18/2014.
 */

var nconf = require('nconf');

// app.get('/noc', noc.index);

exports.index = function(req, res) {
    res.render('nocIndex');
};


// app.get('/noc/ux', noc.uxDashboard);
exports.uxDashboard = function(req, res) {
    res.render('uxDashboard');
};
// app.get('noc.uxData', noc.uxData);
exports.uxData = function(req, res) {
    var data = nconf.use('data');

   try { // try to read the file and get servers variable
       var servers = data.get('servers');
       res.json(servers); // reply with servers json

   } catch (e) { // catch the error n send 500
       util.log(e);
       res.send(500);
   }
};