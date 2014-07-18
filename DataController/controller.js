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
var util = require('util');

var _db = {};
var _current = [];
var _lock = false;
var __dbVersion = new Date().getTime();

var _sock = new events.EventEmitter();

exports.controller = myController;
setTimeout(registerController, 100);


startHandlingSocketData(_sock);

function dbChanged() {
    __dbVersion = new Date().getTime();
    _sock.emit('dbChanged', _db);
};

exports.dbVersion = function dbVersion() {
  return __dbVersion;
};

exports.db = function (newDB) {
    if (newDB) {
        _db = JSON.parse(JSON.stringify(newDB));
        dbChanged();
    } else {
        return _db;
    }
};

exports.current = function current(curr) {

    if (curr) {
        _current = sortServerById(curr.slice());
    } else {
        return sortServerById(_current.slice());
    }
};
function sortServerById(servers) {
    var servers = servers || [];
    return servers.sort(function (a, b) {
        return a.id - b.id;
    });
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
        id: 0,
        name: details.hostName,
        ip: details.ip,
        hostName: details.hostName,
        desc: '',
        groups: [],
        lastUpdate: 0,
        server: details.hostName
    };
    log.debug("Add Server %j", aServer);
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
            dbChanged();

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

        log.trace("Adding data to server with serverId %d", serverId);

        var found = false;
        for (var i = 0; i < _current.length; i++)
        {
            if (serverId === _current[i].id) {

                _current[i].data.push(values);
                found = true;
                i = _current.length;
                log.trace("Added to current data");

            }
        }
        if (!found) {
            var aServer = {
                id: serverId,
                data: [values]
            };
            _current.push(aServer);
            log.trace("Added server to current");
        };
        emitNewData(serverId, values);

};




exports.subscribe = function (handler) {


    _sock.addListener('newData', handler);

};


/*

    getDataRequest(options, callback)

    getDataFromDB
 */

var getData = exports.getData = function getData(options, callback) {

    log.debug("Options to controller.getData: %j", options);

    if (options) {

        var options = options;

        options.startTime = options.startTime || (new Date().getTime() - settings.currentLength || 3600000);
        options.endTime = options.endTime || new Date().getTime();


        if (options.dataTypes && options.dataTypes.length > 0)
        {
            options.dataTypes = getValuesById(_db.dataTypes.slice(), options.dataTypes);

        } else {

            options.dataTypes = _db.dataTypes.slice();
        }

        // Required to send either servers[] or groups[]
        if (options.groups && options.groups.length > 0) {

            log.trace("Required groups found");
            options.servers = getServersByGroup(_db.servers.slice(), options.groups);
            options.groups = getValuesById(_db.groups.slice(), options.groups);


        } else if (options.servers && options.servers.length > 0) {
            log.trace("Required servers found");
            options.servers = getValuesById(_db.servers.slice(), options.servers);
            options.groups = getValuesById(_db.groups.slice(), getGroupIdsByServer(options.servers));

        } else {
            callback(new Error("Invalied options"));
            return;
        };

        log.trace("Options after modification: %j", options);

        getCurrentMatchingData(options, function getCurrentMatchingDataCallback(newOptions, existingData) {

            if (newOptions.more === false) {
                log.trace("newOptions.more === false");
                callback(null, existingData);
            } else {
                log.trace("newOptions %j", newOptions);
                log.trace("existingData %j", existingData);
                myController.getData(newOptions, existingData, callback);
            }
        });

    } else {
        callback(new Error("Invalied options"));
    }

};

// getValuesById (table[ {id: 4}, {id: 0}, {id: 32}, {id: 2} ], rowIds[0,2])
// returns [table[1], table[3]];
function getValuesById (table, rowIds) {

    log.trace("table: %j rows: %j",table, rowIds);

    if(util.isArray(table) && util.isArray(rowIds)) {

        return table.filter(function (row) {

            for (var j = 0; j < rowIds.length; j++)
            {
                if (row.id === rowIds[j]) {
                    return true;
                }
            }
            return false;
        });
    } else {
        return [];
    }
};

// getValuesById (table[ {id: 4}, {id: 0}, {id: 32}, {id: 2} ], rowIds[0,2])
// returns [table[1], table[3]];
exports.getServersByGroupIds = function getServersByGroupIds(groupIds) {
  if (groupIds && groupIds.length && groupIds.length > 0) {

      return getServersByGroup(_db.servers.slice(), groupIds);

  }  else {
      return [];
  }
};

exports.getGroupsByIds = function getGroupsByIds(groupIds) {

    return getValuesById(_db.groups.slice(), groupIds);


};

function getServersByGroup (servers, groupIds) {

    log.trace("Servers: %j", servers);
    log.trace("Groups: %j", groupIds);

    if (util.isArray(servers) && util.isArray(groupIds)) {

        return servers.filter(function (aServer) {

            log.trace("A Server: %j", aServer);

            for (var i = 0; i < aServer.groups.length; i++)
            {
                for (var j = 0; j < groupIds.length; j++) {

                    if (aServer.groups[i] == groupIds[j]) {
                        return true;
                    }
                }
                return false;
            }
        });

    } else {
        log.debug("Didn't send arrays");
        return [];
    }
};

function getGroupIdsByServer(servers) {

    var groupIds = [];

    for (var i = 0; i < servers.length; i++)
    {
        for (var j = 0; j < servers[i].groups; j++)
        {

            var found = false;
            for (var k = 0; k < groupIds.length; k++)
            {
                if (groupIds[k] === servers[i].groups[j]) {
                    found = true;
                }
            }
            if (found === false) {
                groupIds.push(servers[i].groups[j]);
            }
        }
    }
    return groupIds;
};

// options from above
// call next(newOptions, dataFoundInCurrent)
function getCurrentMatchingData(options, next) {

    var newOptions = options;

    var lookUp = makeLookUpKey(newOptions.servers);

    var data = filterDataByTimeAndDataTypes(newOptions.startTime, newOptions.endTime, getFieldsFromDataTypes(newOptions.dataTypes), _current.filter(function (curr) { return lookUp[curr.id]; } ));

    log.trace("data: %j", data);


    if (data.needMore === true && data.completedServerIds.length === newOptions.servers.length) {

        newOptions.more = false;
        next(newOptions, data.data);

    } else {

        newOptions.more = true;
        newOptions.competed = data.completedServerIds;
        next(newOptions, data.data);
    }

};

function filterDataByTimeAndDataTypes(start, end, dataTypes, input) {


    log.trace("input: %j", input);
    log.trace("start: %d  end: %d", start, end);

    var start = start;
    var end = end;

    var ret = {
        needMore: false,
        completedServerIds: [],
        data: []
    };

    for (var i = 0; i < input.length; i++) {

        var temp = constrainAndFilterData(sortDataByTime(input[i].data), start, end, dataTypes);
        log.trace("Constrained: %j", temp);

        if (temp.first > 0 || temp.first == input[i].data.length) {

            ret.completedServerIds.push(input[i].id);

        } else {
            ret.needMore = true;
        }

        ret.data.push({
            id: input[i].id,
            data: temp.newData
        });
    }
    return ret;
}

function getFieldsFromDataTypes(dataTypes) {
    return dataTypes.map(function (dataType) {
       return dataType.field;
    });
}

function constrainAndFilterData(timedData, start, end, dataTypes) {

    log.trace("TimedData: %j", timedData);
    log.trace("DataTypes: %j", dataTypes);

    var first = findFirst(timedData, start);
    var last = findLast(timedData, first, end);
    var newData = cleanDataTypes(timedData.slice(first, last), dataTypes);


    return {
        first: first,
        last: last,
        newData: newData
    };

};

function cleanDataTypes(timedData, dataTypes) {

    log.trace("Sliced Data: %j", timedData);

    return timedData.map(
        function (dataPoint) {

            var newPoint = {
                time: dataPoint.time
            };
            for (var i = 0; i < dataTypes.length; i++) {
                if (dataPoint[dataTypes[i]]) {
                    newPoint[dataTypes[i]] = dataPoint[dataTypes[i]];
                }
            }
            return newPoint;
    });
}

function findFirst(timedData, start) {

    log.trace("start: %d TimedData: %j", start, timedData);
    for (var i = 0; i < timedData.length && timedData[i].time < start;i++) {};
    return i;
}

function findLast(timedData, startAt, stop) {

    log.trace("start: %d, stop: %d, TimedData: %j ", startAt, stop, timedData);
    for (var i = startAt; i < timedData.length && timedData[i].time < stop;i++) {};
    return i;
}


function makeLookUpKey(values) {

    var ret = [];
    values.map(function (val) {
        ret[val.id] = true;
        return val;
    });
    return ret;
}



var getServerId = exports.getServerId = function getServerId(details) {

    log.trace("Details: %j", details);

    // settings.recognizeByOrder default ['hostName', 'ip']
    var recognizedOrder = settings.recognizeByOrder || ['hostName', 'ip'];
    log.trace("recognizedOrder = %j", recognizedOrder);

    for (var i = 0; i < _db.servers.length; i++)
    {

        for (var k = 0; k < recognizedOrder.length; k++)
        {
            if (details[recognizedOrder[k]] === _db.servers[i][recognizedOrder[k]] && (details[recognizedOrder[k]] !== '' && details[recognizedOrder[k]] != undefined))
            {
                log.trace("Found: %d", _db.servers[i].id);
                return _db.servers[i].id;
            }
        }
    }

    // Server not found
    log.debug("Server not found in db %j", details);
    return null;

};

var getServerDetailsById = exports.getServerDetailsById = function getServerDetailsById(id) {


    if (id >= 0) {

        for (var i = 0; i < _db.servers.length; i++)
        {
            if (_db.servers[i].id === id) {

                return JSON.parse(JSON.stringify(_db.servers[i]));
            }
        }
    } else {
        return null;
    }


};


exports.cleanConfig = function(cb) {

    if (settings.version && settings.version >= 1 && settings.dbFile) {

        _db = JSON.parse(fs.readFileSync(path.join(settings.dataDirectory, settings.dbFile), {encoding: 'utf8'}));
        _db.servers = sortTableById(_db.servers);
        _db.groups = sortTableById(_db.groups);
        _db.dashboards = sortTableById(_db.dashboards);
        _db.fronts = sortTableById(_db.fronts);
        _db.dataTypes = sortTableById(_db.dataTypes);
        try {
            _current = JSON.parse(fs.readFileSync(path.join(settings.dataDirectory, settings.dataFile), {encoding: 'utf8'}));
        } catch (err) {
            _current = [];
        }

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
                groups:     [(importDB.servers[i].group * 1) + 1],
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
            for (var j = 0; j < aDashboard.legacyGroups.length; j++) {
                aDashboard.legacyGroups[j]++;
            }
            db.dashboards.push(aDashboard);
        }
        for (var i = 0; i < importDB.dataTypes.length; i++) {
            var aType = {
                id:        importDB.dataTypes[i].id + 1, // 1
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

    log.debug("ToPurge: %j", toPurge);

    for(var i = 0; i < _current.length; i++) // goes through all of current once
    {
        for (var k = 0; k < toPurge.length; k++) // up to n (but n -1) after every call so SUM = (n - 1)
        {
            if (_current[i].id === toPurge[k].id && _current[i].data)
            {
                while (_current[i].data.length > 0 && _current[i].data[0].time <= toPurge[k].time) {

                    _current[i].data.unshift();

                }
                toPurge.splice(k,1);
                k = toPurge.length;
            }
        }
        if (toPurge.length === 0) { // stop processing
            i = _current.length;
        }
    }
};


function emitNewData(serverId, values) {

    // var index = positionById(_db.servers, serverId);

   /* if (index != null) {

        _db.servers[index].lastUpdate = values.time;
    } else {
        log.error("positionById didn't work");
    }*/

    for (var i = 0; i < _db.servers.length; i++) {
        if (_db.servers[i].id == serverId) {
            _db.servers[i].lastUpdate = values.time || new Date().getTime();
            i = _db.servers.length;
        }
    }
    _sock.emit('newData', serverId, values);

};



function registerController() {

    myController.sock(_sock);

}


function sortDataByTime(data) {
    return data.sort(function (a, b) {
        return a.time - b.time;
    });
};


exports.modifyDB = function modifyDB(table, id, value) {

    if (!(table && id && typeof id === 'number' && value)) {
        return false;
    }
    var myTable;
    switch (table) {

        case 'dashboard':
            myTable = _db.dashboards;
            break;
        case 'group':
            myTable = _db.groups;
            break;
        case 'server':
            myTable = _db.servers;
            break;
        case 'dataType':
            myTable = _db.dataTypes;
            break;
        case 'front':
            myTable = _db.fronts;
            break;
        default:
            return false;
    }
    myTable = sortTableById(myTable);
    if (id < 0) {
        value.id = myTable[myTable.length - 1].id + 1;
        myTable.push(JSON.parse(JSON.stringify(value)));
        log.debug("Successfully added value to table %s:%d=%j",table, id, value);
        dbChanged({ table: table, id: id, value: value });
        return true;
    }
    for (var i = 0; i < myTable.length; i++){

        if (id === myTable[i].id) {
            myTable[i] = JSON.parse(JSON.stringify(value));
            myTable[i].id = id; // Always ensure id stays the same
            log.debug("Successfully updated table %s:%d=%j",table, id, value);
            dbChanged({ table: table, id: id, value: value });
            return true;
        }
    }
    value.id = myTable[myTable.length - 1].id + 1;
    myTable.push(JSON.parse(JSON.stringify(value)));
    log.debug("Successfully added value to table %s:%d=%j",table, id, value);
    dbChanged({ table: table, id: id, value: value });
    return true;
};

function sortTableById(table) {

  return table.sort(function (rowA, rowB) {
       return rowA.id - rowB.id;
  });

};


exports.removeFromDB = function deleteValue(table, id) {

    if (!(table && id && typeof id === 'number')) {
        return false;
    }
    var myTable;

    switch (table) {

        case 'dashboard':
            myTable = _db.dashboards;
            break;
        case 'group':
            myTable = _db.groups;
            break;
        case 'server':
            myTable = _db.servers;
            break;
        case 'dataType':
            myTable = _db.dataTypes;
            break;
        case 'front':
            myTable = _db.fronts;
            break;
        default:
            return false;
    }
    var index = -1;
    for (var i = 0; i < myTable.length; i++){

        if (id === myTable[i].id) {
            log.debug("Found row to remove in table %s:%d=%j",table, id, myTable[i]);
            index = i;
            i = myTable.length;
        }
    }
    if (index >= 0) {
        myTable.splice(index,1);
        _sock.emit("dbChanged", { table: table, id: -1*id });
        return true;
    } else {
        return false;
    }
};