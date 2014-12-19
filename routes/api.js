/**
 * Created by Derek Rada on 4/18/2014.
 */

/**
 * Modules
 *
 */

var nconf = require('nconf');
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


exports.current = function (req, res) {


    res.json(controller.current());

};

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

exports.update2 = function update2(req, res) {

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
    log.trace("Keys: %j", keys);
    for (var i = 0; i < keys.length; i++)
    {
        for (var j = 0; j < dataTypes.length; j++)
        {
            if (keys[i] == dataTypes[j].field) {
                log.trace("Found field: %s", keys[i]);
                // TODO add in dataTypes[j] conversions
                values[dataTypes[j].field] = req.body[keys[i]];
            }
        }
        if (keys[i] === 'server' || keys[i] === 'host') {
            details.hostName = req.body.server || req.body.host;
            log.trace("Found server: %s", details.hostName);
        } else if (keys[i] === 'id') {
            details.id = req.body.id;
            log.trace("Found id: %d", details.id);
        }
    }
    details.ip = req.ip;
    res.send(200);

    if (details.id == 0 && (details.hostName == null || keys.length == 0 || details.hostName == "")) {
        log.debug("Throwing this data away %j from %j", values, details);
        return;
    }; // Not adding anything if there is no hostname

    log.trace("Details: %j", details);
    log.trace("Values: %j", values);

    addServerData2(details, values);

};

exports.getDB = function getDB(req, res) {

    var version = controller.dbVersion();
    if (req.params.id && req.params.id > 0 && req.params.id == version) {

        res.json({version: version});

    } else {

        res.json({
         version: version,
         db: controller.db()
        });
    }
};

function addServerData2(details, values) {

    details.id = controller.getServerId(details);
    log.trace("Details: %j", details);
    log.trace("Values: %j", values);

    if (details.id != null)
    {
        log.debug("Adding new data for existing server %s", details.hostName);
        controller.addDataToServer(details.id, values);

    } else {
        log.info("Found new server %j", details);
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

    res.json(sortServerById(controller.current()));
  //  controller.save(5);
};

exports.reload = function(req, res) {

    res.send(200);

    // controller.save(5);


};

exports.manage = function (req, res) {
    res.send("Manage");
};

// TODO
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
    // method (last average or null)


    var options = req.body;
    var method = options.method || req.param('method');

    options.groups = options.groups || [];
    options.servers = options.servers || [];
    options.dataTypes = options.dataTypes || [];
    log.debug("Method = %s", method);

    switch (method) {
        case 'average': // average by server and group
            handleAverage(options, res);
            break;
        case 'last': // last minute
            options.startTime = new Date().getTime() - 60000;
            options.endTime = new Date().getTime();
        default:
            handleDataRequest(options, res);
    }
};

function handleAverage(options, res) {

    log.debug("Options sent: %j", options);
    var ret = {
        servers: [],
        groups: [],
        dataTypes: [],
        data: [],
        averages: {}
    };
    controller.getData(options, function (err, data) {
        if (err) {
            log.error(err);
        } else {
            log.debug("getData returned with data");
            ret = data;
        }
        var toSend = {
            data: ret.data || [],
            averages: {}
        };
        toSend.averages = getAverageCalculations(ret);
        log.debug("getAverageCalcs returned with data");
        res.json(toSend);
    });

};

/***
 *
 * averages: { servers: [ { id: 1, average: { cpu: 32.12, mem: 14.2 } }, { id: 2, average: { cpu: 47:12, mem: 13.6 } } ], groups: [ { id: 1, average: { cpu: 12.4, mem: 14.3 } } ], total: {cpu: 43.1, mem: 12.34 }} }
 * @param values
 */
function getAverageCalculations(values) {

    var ret = values;
    var averages = {
        servers: [],
        groups: [],
        all: {}
    };
    var serverData = ret.data;
    var allCounts = {};
    var groupData = [];

    for (var i = 0; i < ret.groups.length; i++) {
        groupData[ret.groups[i].id] = {
            id: ret.groups[i].id,
            average: {},
            total: {},
            count: {},
            high: {},
            low: {}
        };
    }

    for (var i = 0; i < serverData.length; i++)
    {

        var aServer = {
            id: data[i].id,
            average: {},
            total: {},
            count: {},
            high: {},
            low: {}
        };
        var preGroups = controller.getServerDetailsById(aServer.id).groups || [];
        var groups = [];

        for (var j = 0; j < preGroups.length; j++) { // put groups needed in groups

            for (var k = 0; k < ret.groups.length; k++)
            {
                groups.push(preGroups[j]);
            }
        }

        for (var j = 0; j < ret.dataTypes.length; j++) {
            if (i === 0) {
                averages.all[ret.dataTypes[j].field] = 0.00;
                allCounts[ret.dataTypes[j].field] = 0;
            }
            aServer.average[ret.dataTypes[j].field] = 0.00;
            aServer.total[ret.dataTypes[j].field] = 0.00;
            aServer.count[ret.dataTypes[j].field] = 0;

            for (var k = 0; k < groups.length; k++) {

                groupData[groups[k]].average[ret.dataTypes[j].field] = 0.00;
                groupData[groups[k]].total[ret.dataTypes[j].field] = 0.00;
                groupData[groups[k]].count[ret.dataTypes[j].field] = 0;

            }

        }
        for (var j = 0; j < serverData[i].data.length; j++) { // Go through servers data objects { time: 0, cpu: 0, mem: 0 }

            for (var k = 0; k < ret.dataTypes.length; k++) { // go through the data types

                if (serverData[i].data[j][ret.dataTypes[k].field] != undefined) { // if data point has the dataType

                    // Server
                    aServer.total[ret.dataTypes[k].field] += serverData[i].data[j][ret.dataTypes[k].field]; // add to current servers total
                    aServer.count[ret.dataTypes[k].field]++; // add to current servers count

                    // All
                    averages.all[ret.dataTypes[k].field] += serverData[i].data[j][ret.dataTypes[k].field]; // add to all total
                    allCounts[ret.dataTypes[k].field]++; // add to all count

                    // Highs
                    if (!aServer.high[ret.dataTypes[j].field]) {
                        aServer.high[ret.dataTypes[j].field] = serverData[i].data[j][ret.dataTypes[k].field];
                    } else if (aServer.high[ret.dataTypes[j].field] < serverData[i].data[j][ret.dataTypes[k].field]) {
                        aServer.high[ret.dataTypes[j].field] = serverData[i].data[j][ret.dataTypes[k].field];
                    }
                    // Lows
                    if (!aServer.low[ret.dataTypes[j].field]) {
                        aServer.low[ret.dataTypes[j].field] = serverData[i].data[j][ret.dataTypes[k].field];
                    } else if (aServer.low[ret.dataTypes[j].field] > serverData[i].data[j][ret.dataTypes[k].field]) {
                        aServer.low[ret.dataTypes[j].field] = serverData[i].data[j][ret.dataTypes[k].field];
                    }

                    // Groups
                    for (var l = 0; l < groups.length; l++) { // get group data
                        groupData[groups[l]].count[ret.dataTypes[k].field] += serverData[i].data[j][ret.dataTypes[k].field];
                        groupData[groups[l]].total[ret.dataTypes[k].field] += serverData[i].data[j][ret.dataTypes[k].field];
                    }
                }
            }
        }

        for (var j = 0; j < ret.dataTypes.length; j++) {

            if (aServer.count[ret.dataTypes[j].field] > 0) {
                aServer.average[ret.dataTypes[j].field] = (aServer.total[ret.dataTypes[j].field] / aServer.count[ret.dataTypes[j].field])
            }
            for (var k = 0; k < groups.length; k++) {

                // Highs
                if (!groupData[groups[k]].high[ret.dataTypes[j].field]) {
                    groupData[groups[k]].high[ret.dataTypes[j].field] = aServer.high[ret.dataTypes[j].field];
                } else if (groupData[groups[k]].high[ret.dataTypes[j].field] < aServer.high[ret.dataTypes[j].field]) {
                    groupData[groups[k]].high[ret.dataTypes[j].field] = aServer.high[ret.dataTypes[j].field];
                }
                // Lows
                if (!groupData[groups[k]].low[ret.dataTypes[j].field]) {
                    groupData[groups[k]].low[ret.dataTypes[j].field] = aServer.low[ret.dataTypes[j].field];
                } else if (groupData[groups[k]].low[ret.dataTypes[j].field] > aServer.low[ret.dataTypes[j].field]) {
                    groupData[groups[k]].low[ret.dataTypes[j].field] = aServer.low[ret.dataTypes[j].field];
                }
            }
        }
        averages.servers.push(aServer);
    }

    groupData.forEach(function (group) {

        if (group != null) {

            for (var i = 0; i < ret.dataTypes.length;i++) {

                if (group.count[ret.dataTypes[j].field] > 0) {
                    group.average[ret.dataTypes[j].field] = (group.total[ret.dataTypes[j].field] / group.count[ret.dataTypes[j].field]);
                }
            }
            averages.groups.push(group);
        }
    });

    for (var i = 0; i < ret.dataTypes.length; i++) {
        if (allCounts[ret.dataTypes[i].field] > 0) {
            averages.all[ret.dataTypes[i].field] = (ret.averages.all[ret.dataTypes[i].field] / allCounts[ret.dataTypes[i].field]);
        }
    }
    return averages;

};

function handleDataRequest(options, res) {

    var ret = {
        servers: [],
        groups: [],
        dataTypes: [],
        data: []
    };

    controller.getData(options, function handleDataCallback(err, data) {

        if (data && data.data && data.data[0]) {
            log.debug("HandleDataRequest - FirstResult :: %j", data.data[0]);
        }
        if (err) {
            log.error(err);
        } else {
            ret = data;
        }
        res.json(ret.data);
    });
};


// This will do the post request for data where you send certain groups
// DEPRECATED
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

exports.getData2 = function getData2(req, res) {

    log.debug("GetData2 %s", req.params.id);

    if (req.params.id) {

        var dashboard = getDashboardByUri(req.params.id);

        var options = {
            startTime: new Date().getTime() - 1800000,
            endTime: new Date().getTime(),
            groups: dashboard.legacyGroups
        };
        log.debug("Options: %j", options);
        handleDataRequest(options, res);
        // handleAverage(options, res);
    }
};


exports.getData = function (req, res) {

    if (req.params.id) {

        try {

            var dashboard = getDashboardByUri(req.params.id);

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

    res.json(controller.db().groups);
};

exports.servers = function (req, res) {

    res.json(controller.db().servers);
};

exports.dashboards = function (req, res) {
    res.json(controller.db().dashboards);
};

// TODO
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

// TODO
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

// TODO
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
 TODO
 app.all('/api/dashboard/:id', api.dashboard);
 app.all('/api/server/:id', api.server);
 app.all('/api/group/:id', api.group);

 */

exports.dashboard = function dashboard(req, res) {


    if (req.method == 'GET' || req.method == 'get') {

        var dashboards = controller.db().dashboards;
        var dashboard = {};
        var id = req.params.id;
        for (var i = 0; i < dashboards.length; i++) {
            if (dashboards[i].id === id || dashboards[i].uri.toLowerCase() == id.toString().toLowerCase()) {
                dashboard = dashboards[i];
            }
        }
        if (dashboard.id > 0) {

            var ret = {
                dashboard: dashboard,
                servers: controller.getServersByGroupIds(dashboard.legacyGroups),
                groups: controller.getGroupsByIds(dashboard.legacyGroups)
            };

            log.debug(ret.groups);

            res.json(ret);

        } else {
            res.json(dashboards);
        }


    } else {
        res.send(req.method.toString());
    }



};

exports.server = function server(req, res) {

    res.send(req.method.toString());
};

exports.group = function group(req, res) {

    res.send(req.method.toString());
};



/*
 *   Local / Exports
 *
 */


exports.getArchive = function (req, res) {

    res.status(401).send("This has been deprecated");
    return;

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

function sortServerById(servers) {
    var servers = servers || [];
    return servers.sort(function (a, b) {
        return a.id - b.id;
    });
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

// DONE
function getDashboardByUri(id) {

    var dashboards = controller.db().dashboards || [];

    for (var i = 0; i < dashboards.length; i++)
    {
        if (dashboards[i].uri.toLowerCase() == id.toLowerCase())
        {
            log.debug("Found dashboard");
            return dashboards[i];
        }
    }

    log.debug("Couldn't Find dashboard");
    return dashboards[0] || null; // return the test devices
};

// TODOD
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