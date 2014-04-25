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

    if (req.params.id) {

        var data = nconf.use('data');

        try {

            var groups = [];

            if (req.params.id == 'ux') {
                groups.push(0);
                groups.push(1);
            } else { // testing
                groups.push(2);
            }

            // get servers
            var servers = getServersInGroups(data.get('servers'), groups);

            res.json(sortServers(servers)); // reply with servers json

        } catch (e) { // catch the error n send 500
            util.log(e);
            res.send(500);
        }

    }
};


function getServersInGroups(servers, groups)
{

    var ret = [];
    console.log(servers);
    console.log(groups);

    for (var i = 0; i < servers.length; i++) {

        for (var j = 0; j < groups.length; j++) {

            if (servers[i].group == groups[j]) {
                ret.push(servers[i]);
            }
        }
    }
    console.log("Return getServersInGroups");
    console.log(ret);
    return ret;
}

function sortServers(servers)
{
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
    return servers2;
}