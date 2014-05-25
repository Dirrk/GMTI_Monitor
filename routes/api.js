/**
 * Created by Derek Rada on 4/18/2014.
 */

/**
 * Modules
 *
 */

var nconf = require('nconf').use('data');
var debug = false;
var util = require('util');
var async = require('async');
var http = require('http');


/*  API Calls

 //      * api calls
 * Done *
 app.post('/api/update', api.update);  // Servers send data -- done
 app.get('/save', api.save); // called to initiate a save  -- done
 app.post('/api/data', api.data);  // called to get data about groups of servers
 app.get('/api/data/:id', api.getData); // called from built dashboards
 app.post('/api/groups', api.groups); // called to get list of groups
 app.post('/api/servers', api.servers); // called to get list of servers from db
 app.post('/manage', checkAuth, api.manage);  // saves changes to manage

 */

/**
 *
 *  Version 2:
 *
 *  Instead of having the servers call /api/update we will now deploy gmti_server_responder onto each server that will listen on *:5000/ and respond with the data already in the correct format
 *
 *  This assumes we are using a data set of predetermined servers < Version 2 use servers.json but this version will be configured as a new instance that will use redis for data storage.
 *
 *  To prevent ddos'ing the servers or killing the host server I am going to use async mapLimit to queue up http requests 50 at a time and then measure the time it took to complete all requests and subtract that from 30 seconds and set time out to run again
 *
 *
 */

exports.startCollector = function startCollector(time) {


    if (time && time > 0) {

        var time = time;

    } else if (time && time <= 0) {
        var time = 1;
    } else {
        var time = 30000;
    }

    setTimeout(go, time);

    function go() {

        // get Values
        var servers = nconf.get('db:servers');
        var startTime = new Date().getTime();

        async.mapLimit(servers, 50,
                       function (item, next) {

                           httpPerformRequest(item, function (data) {
                               next(null, data);
                           });

                       }, function (err, results) {



                for ( var i = 0; i < results.length; i++ ) {
                    if (results[i] != 'empty') {
                        var serverData = JSON.parse(results[i]);
                        addServerData(serverData.server, serverData.cpu, serverData.mem);
                    }
                }
                var endTime = new Date().getTime();

                startCollector(30000 - (endTime - startTime));

                console.log(results);


            }
        );
    };

};


function httpPerformRequest(server, cb) {

    var options = {
        method: 'GET',
        host: server.server,
        port: 5000,
        path: '/'
    };


    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        var response = '';
        req.on('socket', function(socket) {
            socket.setTimeout(2500);
            socket.on('timeout', function() {
                req.abort();
                cb('empty');
            });
        });
        res.on('data', function (chunk) {
            response += chunk;
        });
        res.on('end', function () {
            cb(response);
        });
        res.on('error', function (err) {
            req.abort();
            util.error(err);
            cb('empty');
        });
    });

    req.on('error', function(err) {
        console.log("Error trying to update " + server.server);
        console.log(err);
        cb('empty')
    });
    try {
        req.end();
    } catch (e) {
        util.error(e);
        cb('empty');
    }

}


/**
 * /api/update receives data from servers
 *
 * { "server": "host-lx0001", "cpu": 7.789, "used": 5000, "total": 12000 }
 *
 * @param req
 * @param res
 */
exports.update = function(req, res) {

    // console.log("Incoming Request: host=" + req.ip + " data=%j", req.body);

    var server,
        cpu = 0.00,
        memUsed = 0,
        memTotal = 0,
        mem = 0.00;

    try {
        var data = req.body;
        server = data.server || "unknown";
        cpu = parseFloat(data.cpu || "0");
        memUsed = parseInt(data.used || "0");
        memTotal = parseInt(data.total || "0");
        res.send(200);

    } catch (e) {
        res.send(400);
        return;
    }


    if (memTotal != 0) {
        mem = ((memUsed / memTotal) * 100.00);
    }

    // add data to nconf
    addServerData(server, cpu, mem);

};

function addServerData(server, cpu, mem) {

    var server = server.split('.')[0];

    var servers = nconf.get('servers'),
        iterator,
        found;

    // console.log("AddServerData: %j", servers);
    for(iterator = 0, found = servers.length; iterator < servers.length; iterator++)
    {

        if (servers[iterator].server.toUpperCase() == server.toUpperCase())
        {
            found = iterator;
        }
    }
    if (found === servers.length)
    {
        servers.push(
            {
                server: server,
                group: lookUpGroup(server),
                data: []
            }
        );
    } else if (servers[found].group !== undefined || servers[found].group !== null || servers[found].group < 0) {

        // new server will always have this old servers may not have this data because pre vrc1.3 did not have the group info in data.json
        servers[found].group = lookUpGroup(server);

    }
    servers[found].data.push(
        {
            time: new Date().getTime(),
            cpu: cpu || 0.00,
            mem: mem || 0.00
        }
    );

    nconf.set('servers', servers);
    nconf.set('lock', false);
};

exports.save = function(req, res) {
    res.send(200);
    exports.saveToDisk(5);
};

exports.reload = function(req, res) {

    res.send(200);

    exports.saveToDisk(5);


};

exports.manage = function (req, res) {
  res.send("Manage");
};

exports.manageServer = function (req, res) {

    if (req.body.command && util.isArray(req.body.servers)) {

        switch (req.body.command) {

            case 'UPDATE':

                for (var i = 0; i < req.body.servers.length; i++) {
                    updateServerData(req.body.servers[i]);
                }
                break;
            case 'DELETE':
                for (var i = 0; i < req.body.servers.length; i++) {
                    deleteServerData(req.body.servers[i]);
                }
                break;
            case 'CREATE':
                exports.createServer(req, res);
                return;
            default:
                res.send(400);
                return;
        }
        exports.saveToDisk(5);
        res.send(200);
    } else {
        console.log(req.body);
        res.send(400);
    }
};

/*
exports.uxData = function(req, res) {


};

*/


// This will do the post request for data where you send certain groups
exports.data = function (req, res) {

    if (req.body.groups && util.isArray(req.body.groups)) {

        var safeGroups = parseGroups(req.body.groups);

        var servers = getServersInGroups(nconf.get('servers'), safeGroups);

        res.json( {
                      servers: sortServers(servers),
                      groups: groupArray(safeGroups)
                  });

    } else {
        util.log("Requested invalid data");
        util.inspect(req.body);
        res.json([]);
    }

};

exports.getData = function (req, res) {

    if (req.params.id) {

        try {

            var dashboard = getDashboardById(req.params.id);

            // get servers
            var servers = getServersInGroups(nconf.get('servers'), dashboard.groups);

            res.json( {
                          servers: sortServers(servers),
                          groups: groupArray(dashboard.groups)
                      }); // reply with servers json

        } catch (e) { // catch the error n send 500
            util.log(e);
            res.send(500);
        }

    }

};


exports.groups = function (req, res) {

    res.json(nconf.get('db:groups'));
};

exports.servers = function (req, res) {

    res.json(nconf.get('db:servers'));
};

exports.dashboards = function (req, res) {
    res.json(nconf.get('db:dashboards'));
};

exports.createServer = function (req, res) {

    var newServers = [],
        assignedGroupId = -1;

    if (req.body.servers !== null && req.body.servers !== undefined) {

        try {
            if (util.isArray(req.body.servers)) {

                newServers = req.body.servers;

            } else {

                newServers.push(req.body.servers.toString());
            }
        }
        catch (e) {
            console.log(e);
            res.send(400);
            return;
        }

        if (req.body.group !== null && req.body.group !== undefined)
        {
            try {
                assignedGroupId = parseInt(req.body.group);
                assignedGroupId = getGroupById(assignedGroupId).id || -1;
            } catch (ignore) {
                assignedGroupId = -1;
            }
        }

        var servers = nconf.get('db:servers');
        var tempServers = [];
        for (var i = 0; i < newServers.length; i++)
        {
            tempServers.push({
                server: newServers[i],
                group: assignedGroupId
            });
        }
        nconf.set('db:servers', servers.concat(tempServers));
        res.json(tempServers);
        exports.saveToDisk(5);


    } else {
        res.send(400);
    }

};


exports.manageGroup = function (req, res) {

    var groups = nconf.get('db:groups');
    if (req.body.command && req.body.group) {

        var group = req.body.group;
        console.log(req.body);

        switch (req.body.command) {

            case 'UPDATE':

                for (var i = 0; i < groups.length; i++) {

                    if (group.id === groups[i].id) {
                        groups[i].name = group.name;
                    }
                }
                console.log(group);
                nconf.set('db:groups', groups);
                break;
            case 'DELETE':

                console.log("Deleting");
                var found = groups.length;
                for (var i = 0; i < groups.length; i++) {

                    if (group.id === groups[i].id) {
                        found = i;
                    }
                }
                if (found < groups.length) {
                    console.log("Deleting 1");
                    groups.splice(found, 1);
                }
                nconf.set('db:groups', groups);

                break;
            case 'CREATE':

                try {
                    group.id = groups[groups.length - 1].id + 1;

                } catch (e) {
                    group.id = 0;
                }
                groups.push(group);
                nconf.set('db:groups', groups);
                exports.saveToDisk(5);
                res.json(group);

                return;
            default:
                res.send(400);
                return;
        }
        exports.saveToDisk(5);
        res.send(200);
    } else {
        console.log(req.body);
        res.send(400);
    }
};

exports.manageDash = function (req, res) {

    var dashboards = nconf.get('db:dashboards');
    if (req.body.command && req.body.dashboard) {

        var dash = req.body.dashboard;
        console.log(req.body);

        switch (req.body.command) {

            case 'UPDATE':

                for (var i = 0; i < dashboards.length; i++) {

                    if (dash.id === dashboards[i].id) {
                        dashboards[i].front = dash.front;
                        dashboards[i].name = dash.name;
                        dashboards[i].description = dash.description;
                        dashboards[i].groups = dash.groups;
                    }
                }
                console.log(dash);
                nconf.set('db:dashboards', dashboards);
                break;

            case 'DELETE':

                console.log("Deleting Dashboard");
                var found = dashboards.length;
                for (var i = 0; i < dashboards.length; i++) {

                    if (dash.id === dashboards[i].id) {
                        found = i;
                    }
                }
                if (found < dashboards.length) {
                    console.log("Deleting 1");
                    dashboards.splice(found, 1);
                }
                nconf.set('db:dashboards', dashboards);

                break;

            case 'CREATE':

                dashboards.push(dash);
                nconf.set('db:dashboards', dashboards);
                exports.saveToDisk(5);
                res.json(dashboards);

                return;
            default:
                res.send(400);
                return;
        }
        exports.saveToDisk(5);
        res.send(200);
    } else {
        console.log(req.body);
        res.send(400);
    }

};




/*
 *   Local / Exports
 *
 */


/**
 *  Save current data to disk
 *
 * @type {saveToDisk}
 * @param count
 */
exports.saveToDisk = function saveToDisk (count) {

    var count = count || 0;
    count++;

    if (nconf.get('lock') === false || count >= 5)
    {
        if (count == 5)
        {
            console.log("Force Saving data to disk " + (new Date).toLocaleString());
        }

        nconf.set('lock', true);

        cleanUpData(function () {

            nconf.save(function(err) { // then data
                if (err) {
                    console.log(err);
                }
                console.log("Saved successfully %s", (new Date()).toLocaleString());
                nconf.set('lock', false);
            });

        });

    } else {
        setTimeout(function() {
            saveToDisk(count);
        }, Math.floor(Math.random() * 100))
    }

    function cleanUpData(cb) {

        // if (debug === true) { return };

        var servers = nconf.get('servers');
        var toRemove = [];
        var toArchive = [];

        for(var i = 0; i < servers.length; i++)
        {
            var temp = servers[i].data;
            var done = false;

            while (done !== true)
            {
                if (temp.length > 0)
                {
                    if (temp[0].time <= (new Date().getTime() - 3600000))
                    {
                        // console.log("Sending to archive");
                        var newArch = {
                            server: servers[i].server,
                            point: servers[i].data.shift()
                        };
                        // console.log("Sending to archive: %j", newArch);
                        toArchive.push(newArch);

                    } else {
                        done = true;
                    }

                } else {
                    done = true;
                }
            }
            if (servers[i].data.length == 0)
            {
                toRemove.unshift(i);
            }

        }
        for (var k = 0; k < toRemove.length; k++)
        {
            servers.splice(toRemove[k], 1);
        }

        nconf.set('servers', servers);

        if (toArchive.length > 0) {
            console.log("Archiving %d objects", toArchive.length);
            archiveData(toArchive, cb);
        } else if (cb) {
            cb();
        } else {
            console.log("Should not happen ever");
        }

    };


};

exports.getArchive = function (req, res) {


    var db = nconf.get('db:archive');
    res.json(db);

};


function archiveData(toArchive, cb) {

    // console.log("archive data");
    if (!toArchive || toArchive.length === 0) {
        return;
    }

    var archiveServers = nconf.get('db:archive');

    // console.log("Length: " + archiveServers.length);
    // console.log("Incoming: %j", toArchive);

    for (var i = 0; i < archiveServers.length; i++)
    {
        var found = [];

        for (var j = 0; j < toArchive.length; j++)
        {
            if (archiveServers[i].server.toLowerCase() == toArchive[j].server.toLowerCase()) {

                // console.log("Archive: %j", toArchive[j]);
                // console.log("To: " + archiveServers[i].server + " at " + archiveServers[i].data);

                archiveServers[i].data.push(toArchive[j].point);

                found.push(j);

            }
        }
        if (found.length >= 0) { // was found
            // This accounts for multiple archives added from the same host.

            for (var h = 0; h < found.length; h++)
            {
                toArchive = toArchive.splice(found[h], 1);
            }
            // console.log("After splice: %d", toArchive.length);

            if (toArchive.length === 0) // stop searching if we have found what we want
            {
                i = archiveServers.length;
            }
        }
    }
    if (toArchive.length > 0)
    {
        console.warn("Adding new servers to archive: %j", toArchive);
        for (var k = 0; k < toArchive.length; k++)
        {
            archiveServers.push({
                server: toArchive[k].server,
                data: [ toArchive[k].point ]
            });
        }
    }

    nconf.set('db:archive', archiveServers);
    setImmediate(function () {
        cb();
    });
};


function lookUpGroup(serverName) {

    var servers = nconf.get('db:servers');

    for (var i = 0; i < servers.length; i++)
    {
        if (serverName == servers[i].server)
        {
            servers[i].lastUpdate = new Date().getTime();
            nconf.set('db:servers', servers);
            return servers[i].group;
        }
    }
    servers.push({
        server: serverName,
        group: -1,
        lastUpdate: new Date().getTime()
                 });
    nconf.set('db:servers', servers);
    return -1;
};

function getServersInGroups(servers, groups) {

    var ret = [];

    for (var i = 0; i < servers.length; i++) {

        for (var j = 0; j < groups.length; j++) {

            if (servers[i].group == groups[j]) {
                ret.push(servers[i]);
            }
        }
    }

    return ret;
};

function sortServers(servers) {
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
};

function parseGroups(inputGroups) {

    var groups = nconf.get('db:groups');
    var ret = [];

    for (var i = 0; i < groups.length; i++)
    {

        for (var j = 0; j < inputGroups.length; j++)
        {
            if (inputGroups[j] == groups[i].id)
            {
                ret.push(groups[i].id);
            }
        }

    }

    return ret;
};

function getDashboardById(id) {

    var dashboards = nconf.get("db:dashboards") || [];
    for (var i = 0; i < dashboards.length; i++)
    {
        if (dashboards[i].id.toLowerCase() == id.toLowerCase())
        {
            return dashboards[i];
        }
    }
    return dashboards[0] || null; // return the test devices
};

function getGroupById(id) {
    var groups = nconf.get("db:groups") || [];
    for (var i = 0; i < groups.length; i++)
    {
        if (groups[i].id == id)
        {
            return groups[i];
        }
    }

    return null;
};

function groupArray(arr) {

    var ret = [];
    var temp = null;
    for (var i = 0; i < arr.length; i++)
    {
        temp = getGroupById(arr[i]);
        if (temp !== null) {
            ret.push(temp);
        }
    }
    return ret;

};

function deleteServerData(server) {

    var servers = nconf.get('db:servers');
    var found = servers.length;
    for(var i = 0; i < servers.length; i++)
    {

        if (server.server.toLowerCase() == servers[i].server.toLowerCase()) {

            found = i;
        }
    }
    if (found < servers.length)
    {
        servers.splice(found, 1);
        nconf.set('db:servers', servers);
        return true;
    }
    return false;
};

function updateServerData(server) {

    var servers = nconf.get('db:servers');
    for(var i = 0; i < servers.length; i++)
    {

        if (server.server.toLowerCase() == servers[i].server.toLowerCase()) {

            console.log("updateServer found server");

            if (server.group !== undefined && server.group !== null && isNaN(server.group) === false)
            {
                servers[i].group = server.group;
                console.log("Changed server(" + server.server + ") to " + server.group);
            }
        }
    }
    nconf.set('db:servers', servers);
    return true;
};