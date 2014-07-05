/**
 * Created by Derek Rada on 6/29/2014.
 */

var settings = require('../settings.json');
var path = require('path');
var myController = require(path.join(__dirname, settings.controller));
var log = require('easy-logger').logger();
var fs = require('fs');
var nconf = require('nconf');
var async = require('async');
var events = require('events');

var _db = {};
var _current = [];
var _lock = true;

var _sock = new events.EventEmitter();

exports.controller = myController;
setTimeout(registerController, 100);


startHandlingSocketData(_sock);

exports.db = function (ddbb) {
    if (ddbb) {
        _db = ddbb;
    } else {
        return _db;
    }
};

exports.current = function (curr) {

    if (curr) {
        _current = curr;
    } else {
        return _current;
    }
};

// Locking write / remove access from the current set of servers
var lock = exports.lock = function lock (setter) {
    if (setter === undefined || setter === null) {
        return _lock;
    } else {
        if ((_lock === false && setter === 1) || (_lock === false && setter === 1)) { // not locked or overide
            _lock = true;
            return true;
        } else if (setter === 0) { // set to unlocked
            _lock = false;
            return true;
        } else {
            return false;
        }
    }
};

exports.save = myController.save;

exports.addServer = function (details, cb) {

    // add server to current and to _db
    var aServer = {
        hostName: details.hostName,
        ip: details.ip,
        name: details.hostName,
        desc: ''
    };

    myController.newServer(aServer, function(err, server) {
        if (err) {
            log.warn("Couldn't add server");
            log.error(err);
        } else {

            var aCurr =  {
              server: server.server,
              id: server.id,
              data: []
            };

            _db.servers.push(server);
            _current.push(aCurr);

            if (cb) {
                cb(server);
            }
        }
    });

};

/***
 *
 * @function {addDataToServer}
 *
 * @params serverId(int), values(obj)
 */

var addDataToServer = exports.addDataToServer = function addDataToServer(serverId, values) {


    if (lock()) {

        for (var i = 0; i < _current.length; i++)
        {
            if (serverId === _current[i].id) {

                _current[i].data.push(values);

            }
        }
        lock(0);
        emitNewData(serverId, values);

    } else {
        setTimeout(
            function() {
                addDataToServer(serverId, values);
            },
         50);
    }
};


exports.subscribe = function (handler) {


    _sock.addListener('newData', handler);

};


var getServerId = exports.getServerId = function getServerId(details) {

    // settings.recognizeByOrder default ['hostName', 'ip']
    var recognizedOrder = settings.recognizeByOrder || ['hostName', 'ip'];

    for (var i = 0; i < _db.servers.length; i++)
    {
        for (var k = 0; k < recognizedOrder; k++)
        {

            if (details[recognizedOrder[k]] === _db.servers[i][recognizedOrder[k]] && (details[recognizedOrder[k]] !== '' || details[recognizedOrder[k]] != undefined))
            {
                return _db.servers[i].id;
            }
        }
    }

    // Server not found
    return null;

};

var getServerDetailsById = exports.getServerDetailsById = function getServerDetailsById(id) {


    if (id >= 0) {

        for (var i = 0; i < _db.servers.length; i++)
        {
            if (_db.servers[i].id === id) {

                return _db.servers[i];

            }
        }
    } else {
        return null;
    }


};


exports.cleanConfig = function(cb) {

    if (settings.version && settings.version >= 1 && settings.dbFile) {

        _db = JSON.parse(fs.readFileSync(path.join(settings.dataDirectory, settings.dbFile), {encoding: 'utf8'}));
        _current = JSON.parse(fs.readFileSync(path.join(settings.dataDirectory, settings.dbFile), {encoding: 'utf8'}));
        cb();

    } else if (settings.dbFile) {

    // This is used to import from pre-controller setup.  Project was incomplete and put together with tape because simple project always needs more features that weren't intended for

        var db = {
            servers:    [],
            groups:     [],
            dashboards: [],
            fronts:     [],
            dataTypes:  []
        };
        var importDB = {};
        try {
            nconf.add('data', {type: 'file', file: settings.dataDirectory + settings.dataFile, loadSync: true });
            importDB = nconf.get('db');
            importDB.length;

        } catch (e) {

            log.error("DB Settings found however there is no version.  Please stop the service and add the version to the settings.json file.");
            setTimeout(function () {
                           process.exit(-1);
                       }, 60000
            );
            return;
        }

        for (var i = 0; i < importDB.servers.length; i++) {
            var aServer = {
                id:         i + 1,
                name:       importDB.servers[i].server,
                ip:         '',
                hostName:   importDB.servers[i].server,
                desc:       '',
                groups:     [importDB.servers[i].group],
                lastUpdate: importDB.servers[i].lastUpdate,
                server:     importDB.servers[i].server // legacy keeping for now so I can find errors easier
            };
            db.servers.push(aServer);
        }
        for (var i = 0; i < importDB.groups.length; i++) {
            var aGroup = {
                id:   i + 1,
                name: importDB.groups[i].name,
                desc: ''
            };
            db.groups.push(aGroup);
        }
        for (var i = 0; i < importDB.dashboards.length; i++) {
            var aDashboard = {
                id:           i + 1,
                uri:          importDB.dashboards[i].id,
                front:        importDB.dashboards[i].front * 1,
                name:         importDB.dashboards[i].name,
                desc:         importDB.dashboards[i].description,
                legacyGroups: importDB.dashboards[i].groups || [], // Keeping this legacy option until a future release that allows for dynamic dashboards
                template:     'dashboard', // Currently just loading up a jade template but this will change in the future
                layout:       {

                },
                settings:      {

                }
            };
            db.dashboards.push(aDashboard);
        }
        for (var i = 0; i < importDB.dataTypes.length; i++) {
            var aType = {
                id:        importDB.dataTypes[i].id, // 1
                name:      importDB.dataTypes[i].name, // CPU Percentage
                field:     importDB.dataTypes[i].name, // cpu
                valueType: 'Percent' // everything up to now has been a percent
            };
            db.dataTypes.push(aType);
        }

        for (var i = 0; i < importDB.fronts.length; i++) {
            var aFront = {
                id:        importDB.fronts[i].id,
                name:      importDB.fronts[i].name, // MOC
                uri:       importDB.fronts[i].url, // /moc
                template:  'dashIndex'
            };
            db.fronts.push(aFront);
        }

        log.log("Db setup: %j", db);
        var outFile = path.join(settings.dataDirectory, settings.dbFile);

        fs.writeFileSync(outFile, JSON.stringify(db), { encoding: 'utf8' });
        log.log("Successfully wrote out db file to %j", outFile);
        _db = db;
        nconf.clear('db');

        var currentServers = nconf.get("servers");
        _current = [];
        for (var i = 0; i < currentServers; i++) {

            var j = 0;
            var found = false;
            for (; j< db.servers.length; j++) {
                if (!found && currentServers[i].server.toLowerCase() == db.servers[j].server.toLowerCase()) {
                    found = true;
                    var aServer = {
                        id: db.servers[j].id,
                        server: db.servers[j].server.toLowerCase(),
                        data: currentServers[i].data
                    };
                    _current.push(aServer);
                }
            }
            // Add servers that haven't been setup yet
            // if they have data but why wouldn't they? idk
            if (!found && currentServers[i].data && currentServers[i].data.length > 0) {

                var aServer = {
                    id: db.servers[j - 1].id + 1,
                    server: currentServers[i].server.toLowerCase(),
                    data: currentServers[i].data
                };

                var bServer = {
                    id:         aServer.id,
                    name:       aServer.server,
                    ip:         '',
                    hostName:   aServer.server,
                    desc:       '',
                    groups:     [currentServers[i].group || null],
                    lastUpdate: aServer.data[aServer.data.length - 1].time,
                    server:     aServer.server // legacy keeping for now so I can find errors easier
                };
                db.servers.push(bServer);
                _current.push(aServer);
            }
        };
        nconf.set('servers', _current);

        nconf.save(function (err) {
            myController.fixArchive(
                function () {

                    // load current here
                    fs.writeFileSync(path.join(settings.dataDirectory, settings.dataFile), JSON.stringify(_current));

                    setInterval(function () {
                           log.error("You now need to add the version onto the settings.json file.  This will repeat indefinitely");
                        }, 5000
                    );
                }
            );
        });


    } else {
        log.error("Starting without db file setup.  This is no longer supported please check your settings.");
        setTimeout(function () {
                       process.exit(-1);
                   }, 2000
        )
    }

};


function startHandlingSocketData(sock) {

    purgeDataHandler(sock);

};


/**
 *  toPurge[{id: 0, data: time}]
 *
 * @param sock
 */

function purgeDataHandler(sock) {

    sock.on('purge', function(data) {

        if (data && data.length > 0) {
            purgeData(data);
        }
    });
}

function purgeData(toPurge) {

    if (lock()) {

        for(var i = 0; i < _current.length; i++) // goes through all of current once
        {
            for (var k = 0; k < toPurge.length; k++) // n^2
            {
                if (_current[i].id === toPurge[k].id && _current[i].data)
                {

                    for (var j = 0; j < _current[i].data.length; j++) // time is n^3
                    {

                        if (_current[i].data[j].time === toPurge[k].time) {
                            _current[i].data.splice(j,1);
                            j = _current[i].data.length;
                        }

                    }
                }
            }
        }
        lock(0);
    } else {

        setTimeout(
          function() {
            purgeData(id, time);
          }
        , 25);

    }

};


function emitNewData(serverId, values) {

    _sock.emit('newData', serverId, values);

};


function registerController() {

    myController.sock(_sock);

}