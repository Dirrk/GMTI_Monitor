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
var log = require('easy-logger').logger();
var controller = require('../DataController/controller');


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
        var servers = controller.current();
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

                log.debug(results);


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
            log.error(err);
            cb('empty');
        });
    });

    req.on('error', function(err) {
        log.error("Error trying to update " + server.server);
        log.error(err);
        cb('empty')
    });
    try {
        req.end();
    } catch (e) {
        log.error(e);
        cb('empty');
    }

}
**/

/**
 * /api/update receives data from servers
 *
 * { "server": "host-lx0001", "cpu": 7.789, "used": 5000, "total": 12000 }
 *
 * @param req
 * @param res
 *
 * TODO
 * Priority = LOW
 * Parse these dynamically based on dataTypes
 *
 */

exports.update = function(req, res) {

    // log.log("Incoming Request: host=" + req.ip + " data=%j", req.body);

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

// var test = { "job": 5, "test": 3, "bob": "twenty" };
// for (var i = 0; i < Object.keys(test).length; i++) { console.log(Object.keys(test)[i]); }
// for (var i = 0; i < Object.keys(test).length; i++) { console.log(test[Object.keys(test)[i]]); }

exports.update2 = function (req, res) {

    var details = {
        id: 0,
        ip: '',
        hostName: ''
    };
    var values = {
        time: new Date().getTime()
    };

    var dataTypes = controller.db().dataTypes;

    var keys = Object.keys(req.body);
    for (var i = 0; i < keys.length; i++)
    {
        for (var j = 0; j < dataTypes.length; j++)
        {
            if (keys[i] == dataTypes[j].field) {
                values[dataTypes[j].field] = req.body[keys[i]];
            }
        }
        if (keys[i] == 'server' || keys[i] == 'host') {
            details.hostName = req.body.server || req.body.host;
        } else if (keys[i] == 'id') {
            details.id = req.body.id;
        }
    }
    details.ip = req.ip;

    res.send(200);

    addServerData2(details, values);

};


function addServerData2(details, values) {

    values.time = new Date().getTime();
    details.id = controller.getServerId(details);

    if (details.id != null)
    {
        controller.addDataToServer(details.id, values);

    } else {

        controller.addServer(details, function(newServer) {

            controller.addDataToServer(newServer.id, values);

        });
    }

};


function addServerData(server, cpu, mem) {

    var values = {
        time: new Date().getTime(),
        cpu: cpu || 0.00,
        mem: mem || 0.00
    };

    var details = {
        hostName: server
    };

    details.id = controller.getServerId(details) || null;

    if (details.id !== null && details.id >= 0)
    {
        controller.addDataToServer(details.id, values);

    } else {

        controller.addServer(details, function(newServer) {

            controller.addDataToServer(newServer.id, values);

        });
    }
};

exports.save = function(req, res) {
    res.send(200);
    controller.save(5);
};

exports.reload = function(req, res) {

    res.send(200);

    controller.save(5);


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
        controller.save(5);
        res.send(200);
    } else {
        log.debug(req.body);
        res.send(400);
    }
};

/*
 exports.uxData = function(req, res) {


 };

 */


exports.data2 = function (req, res) {

    // start time Date.now() - defaultMins * 60000
    // end time Date.now()
    // groups []
    // servers []
    // dataTypes (cpu, mem)
    // method (current, avgByGroup, avgByServer, currentAvgByGroup, currentAvgByServer, currentAvg)






};

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
        log.warn("Requested invalid data %j", req.body);
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
            log.error(e);
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
            log.error(e);
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
        controller.save(5);


    } else {
        res.send(400);
    }

};

exports.manageGroup = function (req, res) {

    var groups = nconf.get('db:groups');
    if (req.body.command && req.body.group) {

        var group = req.body.group;
        log.debug(req.body);

        switch (req.body.command) {

            case 'UPDATE':

                for (var i = 0; i < groups.length; i++) {

                    if (group.id === groups[i].id) {
                        groups[i].name = group.name;
                    }
                }
                log.debug(group);
                nconf.set('db:groups', groups);
                break;
            case 'DELETE':

                log.debug("Deleting");
                var found = groups.length;
                for (var i = 0; i < groups.length; i++) {

                    if (group.id === groups[i].id) {
                        found = i;
                    }
                }
                if (found < groups.length) {
                    log.debug("Deleting 1");
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
                controller.save(5);
                res.json(group);

                return;
            default:
                res.send(400);
                return;
        }
        controller.save(5);
        res.send(200);
    } else {
        log.warn(req.body);
        res.send(400);
    }
};

exports.manageDash = function (req, res) {

    var dashboards = nconf.get('db:dashboards');
    if (req.body.command && req.body.dashboard) {

        var dash = req.body.dashboard;
        log.debug(req.body);

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
                log.debug(dash);
                nconf.set('db:dashboards', dashboards);
                break;

            case 'DELETE':

                log.debug("Deleting Dashboard");
                var found = dashboards.length;
                for (var i = 0; i < dashboards.length; i++) {

                    if (dash.id === dashboards[i].id) {
                        found = i;
                    }
                }
                if (found < dashboards.length) {
                    log.debug("Deleting 1");
                    dashboards.splice(found, 1);
                }
                nconf.set('db:dashboards', dashboards);

                break;

            case 'CREATE':

                dashboards.push(dash);
                nconf.set('db:dashboards', dashboards);
                controller.save(5);
                res.json(dashboards);

                return;
            default:
                res.send(400);
                return;
        }
        controller.save(5);
        res.send(200);
    } else {
        log.debug(req.body);
        res.send(400);
    }

};




/*
 *   Local / Exports
 *
 */


exports.getArchive = function (req, res) {

    res.status(401).send("This is no longer supported");
    var db = nconf.get('archive');
    res.json(db);

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


// TODO
// Switch to RESTFul
// This will just call controller.editServer('delete', id);
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


// TODO
// Change how this works completely
// 1. Change app to be RESTful (post=create/put=update/get=get/delete=delete)
// 2. This will just call controller.editServer('update', id, values);
function updateServerData(server) {

    // var servers = controller.db().servers;
    var servers = nconf.get('db:servers');
    for(var i = 0; i < servers.length; i++)
    {

        if (server.server.toLowerCase() == servers[i].server.toLowerCase()) {

            log.debug("updateServer found server");

            if (server.group !== undefined && server.group !== null && isNaN(server.group) === false)
            {
                servers[i].group = server.group;
                log.debug("Changed server(" + server.server + ") to " + server.group);
            }
        }
    }
    nconf.set('db:servers', servers);
    return true;
};