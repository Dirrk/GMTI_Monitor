/**
 * Created by Derek Rada on 7/17/2014.
 */


var debug = false;
var util = require('util');
var async = require('async');
var http = require('http');
var log = require('easy-logger').logger();
var controller = require('../DataController/controller');




// manage
exports.index = function (req, res) {

    res.render('manage2');

};

// /api/groups
exports.groups = function (req, res) {

    var start = 0;
    start = req.param('start') || -1;
    if (start === -1) {
        res.json(

            {
                groups: controller.db().groups
            }
        );
        return;
    }

    var groups = controller.db().groups;
    var total = groups.length;
    if (start < groups.length) {

        var ret = [];
        for (var i = 0; i < groups.length && ret.length < 10; i++) {

            if (groups[i].id >= start) {
                ret.push(groups[i]);
            }
        }
        res.json({
                     groups: ret,
                     total: total
                 });

    } else {
        res.json(controller.db().groups);
    }

};

// /api/servers
exports.servers = function (req, res) {

    var start = 0;
    start = req.param('start') || -1;
    if (start === -1) {
        res.json(

            {
                servers: controller.db().servers
            }
        );
        return;
    }


    var servers = controller.db().servers;
    var total = servers.length;
    if (start < servers.length) {

        var ret = [];
        for (var i = 0; i < servers.length && ret.length < 10; i++) {

            if (servers[i].id >= start) {
                ret.push(servers[i]);
            }
        }
        res.json({
                     servers: ret,
                     total: total
                 });

    } else {
        res.json(controller.db().servers);
    }
};

// /api/dashboards
exports.dashboards = function (req, res) {
    var start = 0;
    start = req.param('start') || -1;
    if (start === -1) {
        res.json(

            {
                dashboards: controller.db().dashboards
            }
        );
        return;
    }

    var dashboards = controller.db().dashboards;
    var total = dashboards.length;
    if (start < dashboards.length) {

        var ret = [];
        for (var i = 0; i < dashboards.length && ret.length < 10; i++) {

            if (dashboards[i].id >= start) {
                ret.push(dashboards[i]);
            }
        }
        res.json({
                     dashboards: ret,
                     total: total
                 });

    } else {
        res.json(controller.db().dashboards);
    }

};
// /api/dataTypes
exports.dataTypes = function (req, res) {

    var start = 0;
    start = req.param('start') || -1;
    if (start === -1) {
        res.json(
            {
                dataTypes: controller.db().dataTypes
            }
        );
        return;
    }

    var dataTypes = controller.db().dataTypes;
    var total = dataTypes.length;
    if (start < dataTypes.length) {

        var ret = [];
        for (var i = 0; i < dataTypes.length && ret.length < 10; i++) {

            if (dataTypes[i].id >= start) {
                ret.push(dataTypes[i]);
            }
        }
        res.json({
                     dataTypes: ret,
                     total:     total
                 }
        );

    } else {
        res.json(controller.db().dataTypes);

    }
};

// /api/fronts
exports.fronts = function (req, res) {

    var start = 0;
    start = req.param('start') || -1;
    if (start === -1) {
        res.json(

            {
                fronts: controller.db().fronts
            }
        );
        return;
    }

    var fronts = controller.db().fronts;
    var total = fronts.length;
    if (start < fronts.length) {

        var ret = [];
        for (var i = 0; i < fronts.length && ret.length < 10; i++) {

            if (fronts[i].id >= start) {
                ret.push(fronts[i]);
            }
        }
        res.json({
                     fronts: ret,
                     total: total
                 });

    } else {
        res.json(controller.db().fronts);
    }
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

    var id = req.params.id;
    if (!id) {
        res.send(401);
        return;
    };
    switch (req.method) {
        case 'GET':
            getDashboard(res, id);
            break;
        case 'PUT':
            updateDashboard(res, id, req.body);
            break;
        case 'POST':
            addDashboard(res, id, req.body);
            break;
        case 'DELETE':
            deleteDashboard(res, id);
            break;
        default:
            res.send(401);
    }
};

function findDashboard(id) {

    var dashboards = controller.db().dashboards;
    var intId = -1;
    try {
        intId = parseInt(id);
    } catch (e) {
        log.error(e);
    }

    for (var i = 0; i < dashboards.length; i++) {

        if (typeof intId === 'number' && dashboards[i].id === intId) {
            return dashboards[i];

        } else if (dashboards[i].uri.toLowerCase() == id.toString().toLowerCase()) {
            return dashboards[i];
        }
    }
    log.debug("id = %j", { id: id } );
    return null;
};

// getDashboard(res, id)
// { dashboard: {}, servers: [], groups: [] }
function getDashboard(res, id) {


    var dashboard = findDashboard(id);

    if (dashboard) {

        var ret = {
            dashboard: dashboard,
            servers: controller.getServersByGroupIds(dashboard.legacyGroups),
            groups: controller.getGroupsByIds(dashboard.legacyGroups)
        };

        log.trace(ret.groups);

        res.json(ret);

    } else {
        res.json({
            dashboard: null,
            servers: [],
            groups: []
        });
    }

};

/**
 * {
			"id" : 1,
			"uri" : "dev_test",
			"front" : 0,
			"name" : "Dev Test",
			"desc" : "Test dashboard",
			"legacyGroups" : [1, 2, 3],
			"template" : "dashboard",
			"layout" : {},
			"settings" : {}

		}
 * @param res
 * @param id
 * @param body
 */
function updateDashboard(res, id, body) {

    var dashboard = findDashboard(id);
    if (dashboard) {

        dashboard.uri = body.uri || dashboard.uri;
        dashboard.name = body.name || dashboard.name;
        dashboard.front = body.front || dashboard.front;
        dashboard.desc = body.desc || dashboard.desc;
        dashboard.legacyGroups = body.legacyGroups || dashboard.legacyGroups;
        dashboard.template = body.template || dashboard.template;
        dashboard.layout = body.layout || dashboard.layout;
        dashboard.settings = body.settings || dashboard.settings;

        if (controller.modifyDB('dashboard', dashboard.id, dashboard)) {
            res.send(200);
        } else {
            res.send(500);
        }

    } else {
        res.send(401); // bad request
    }

};

// TODO add return dashboard
function addDashboard(res, id, body) {

    var dashboard = {};

    dashboard.id = -1;
    dashboard.uri = body.uri || 'unknown';
    dashboard.name = body.name || 'unknown';
    dashboard.front = body.front || 0;
    dashboard.desc = body.desc || '';
    dashboard.legacyGroups = body.legacyGroups || [];
    dashboard.template = body.template || "dashboard";
    dashboard.layout = body.layout || {};
    dashboard.settings = body.settings || {};

    if (controller.modifyDB('dashboard', dashboard.id, dashboard)) {
        res.send(200);
    } else {
        res.send(500);
    }
};
function deleteDashboard(res, id) {

    var dashboard = findDashboard(id);
    if (dashboard) {

        if (controller.removeFromDB('dashboard', dashboard.id)) {
            res.send(200);
        } else {
            res.send(500);
        }

    } else {
        res.send(401);
    }

};


exports.server = function server(req, res) {

    var id = req.params.id;
    if (!id) {
        res.send(401);
        return;
    };
    switch (req.method) {
        case 'GET':
            getServer(res, id);
            break;
        case 'PUT':
            updateServer(res, id, req.body);
            break;
        case 'POST':
            addServer(res, id, req.body);
            break;
        case 'DELETE':
            deleteServer(res, id);
            break;
        default:
            res.send(401);
    }
};

function findServer(id) {

    var servers = controller.db().servers;
    var intId = -1;
    try {
        intId = parseInt(id);
    } catch (e) {
        log.error(e);
    }

    for (var i = 0; i < servers.length; i++) {

        if (typeof intId === 'number' && servers[i].id === intId) {
            return servers[i];

        } else if (servers[i].name.toLowerCase() == id.toString().toLowerCase()) {
            return servers[i];
        }
    }
    log.debug("id = %j", { id: id } );
    return null;
};

// getDashboard(res, id)
// { dashboard: {}, servers: [], groups: [] }
function getServer(res, id) {

    var server = findServer(id);

    if (server) {

        res.json(server);

    } else {
        res.send(403);
    }

};

function updateServer(res, id, body) {

    var server = findServer(id);
    if (server) {

        server.name = body.name || server.name;
        server.ip = body.ip || server.ip;
        server.hostName = body.hostName || server.hostName;
        server.desc = body.desc || server.desc;
        server.groups = body.groups || server.groups || [];
        server.server = body.server || server.server;

        for (var i = 0; i < server.groups.length; i++) {
            server.groups[i] = server.groups[i] * 1;
        }

        if (controller.modifyDB('server', server.id, server)) {
            res.send(200);
        } else {
            res.send(500);
        }

    } else {
        res.send(403); // bad request
    }

};

// Return id
function addServer(res, id, body) {

    var server = {};

    server.id = -1;
    server.name = body.name || '';
    server.ip = body.ip || '';
    server.hostName = body.hostName || '';
    server.desc = body.desc || '';
    server.groups = body.groups || [];
    server.server = body.server || '';
    server.lastUpdate = new Date().getTime();

    if (controller.modifyDB('server', server.id, server)) {
        res.send(200);
    } else {
        res.send(500);
    }
};

function deleteServer(res, id) {

    var server = findServer(id);
    if (server) {

        if (controller.removeFromDB('server', server.id)) {
            res.send(200);
        } else {
            res.send(500);
        }

    } else {
        res.send(401);
    }
};


exports.group = function group(req, res) {

    var id = req.params.id;
    if (!id) {
        res.send(403);
        return;
    };
    switch (req.method) {
        case 'GET':
            getGroup(res, id);
            break;
        case 'PUT':
            updateGroup(res, id, req.body);
            break;
        case 'POST':
            addGroup(res, id, req.body);
            break;
        case 'DELETE':
            deleteGroup(res, id);
            break;
        default:
            res.send(403);
    }
};

function findGroup(id) {

    var groups = controller.db().groups;
    var intId = -1;
    try {
        intId = parseInt(id);
    } catch (e) {
        log.error(e);
    }

    for (var i = 0; i < groups.length; i++) {

        if (typeof intId === 'number' && groups[i].id === intId) {
            return groups[i];

        } else if (groups[i].name.toLowerCase() == id.toString().toLowerCase()) {
            return groups[i];
        }
    }
    log.debug("id = %j", { id: id } );
    return null;
};

// getDashboard(res, id)
// { dashboard: {}, servers: [], groups: [] }
function getGroup(res, id) {

    var group = findGroup(id);

    if (group) {

        res.json(group);

    } else {
        res.send(403);
    }

};

function updateGroup(res, id, body) {

    var group = findGroup(id);
    if (group) {

        group.name = body.name || group.name;
        group.desc = body.desc || group.desc;

        if (controller.modifyDB('group', group.id, group)) {
            res.json(group);
        } else {
            res.send(500);
        }

    } else {
        res.send(403); // bad request
    }

};

// send id
function addGroup(res, id, body) {

    var group = {};

    group.id = -1;
    group.name = body.name || '';
    group.desc = body.desc || '';

    if (controller.modifyDB('group', group.id, group)) {
        res.send(200);
    } else {
        res.send(500);
    }
};

function deleteGroup(res, id) {

    var group = findGroup(id);
    if (group) {

        if (controller.removeFromDB('group', group.id)) {
            res.send(200);
        } else {
            res.send(500);
        }

    } else {
        res.send(403);
    }
};


