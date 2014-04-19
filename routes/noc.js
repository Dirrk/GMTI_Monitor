/**
 * Created by Derek Rada on 4/18/2014.
 */

var nconf = require('nconf');
// var data = nconf.use('data');
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

    data.load(function(err) {
        if (err) { // call back with error

            util.log(err);
            res.send(500); // reply with 500 server error

        } else { // file loaded

            try { // try to read the file and get servers variable
                var servers = data.get('servers');
                res.json(servers); // reply with servers json

            } catch (e) { // catch the error n send 500

                util.log(e);
                res.send(500);
            }
        }

    });
};