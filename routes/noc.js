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
       var servers = data.get('servers'); // sort the list before sending
       var servers2 = servers.sort(function (a, b) {
           if (a.server < b.server)
           {
               return -1;
           } else if (a.server > b.server) {
               return 1;
           } else {
               return 0;
           }

       });
       res.json(servers2); // reply with servers json

   } catch (e) { // catch the error n send 500
       util.log(e);
       res.send(500);
   }
};