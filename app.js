/**
 * Created by Derek Rada on 4/18/2014.
 */


/**
 * Module dependencies.
 */

var cluster = require('cluster'),
    util = require('util'),
    slave;

/**
 *  Master process
 */

if (cluster.isMaster)
{

    console.log("Master started: " + (new Date).toLocaleString());
    console.log("Memory usage: %j", util.inspect(process.memoryUsage()));
    slave = cluster.fork();
    var lastDied = new Date().getTime();

    cluster.on('exit', function(deadSlave, code, signal) {

        console.log('Slave %d died with code/signal (%s). Restarting slave ', deadSlave.id, signal || code);
        if (((new Date()).getTime() - 2000) < lastDied) {

            setTimeout(function () {
                slave = cluster.fork('production');
                lastDied = new Date().getTime();
                console.log("Restarting to fast check data.json to see if it has been corrupted");
            }, 5000);

        } else {
            slave = cluster.fork('production');
            lastDied = new Date().getTime();
        }

    });

}
/**
 *  Slave process
 *
 */

else {



    var easylogger = require('easy-logger');
    var log = easylogger.startGlobal({ level: 2 });

    log.log("Attempting to start slave process pid: %d", process.pid);

    global._lockArchive = false;
    var fs = require('fs');
    var path = require('path');
    var nconf = require('nconf');
    var async = require('async');
    nconf.add('data', {type: 'file', file: './public/data/data.json', loadSync: true });
    nconf.use('data').set('lock', false);

    var settings = require('./settings.json') || {
        "dataDirectory": "./public/data/",
        "dataFile": "data.json",
        "archiveFolder": "./public/data/",
        "tempArchiveLength": 2,
        "archiveDays": 14
    };

    startSlave();

    // Setup before allowing slave to even start

    // fix nconf setups


    function startSlave() {

        fixFronts();
        fixDataTypes();

        fixArchive(function (val) {
            if (val === true) {

                log.debug("Attempting to clean archive storage");
                cleanUpArchive(function () {
                    log.debug("Successfully cleaned archive storage");
                    strictWrapper();
                });
            }
        });
    };

    function cleanUpArchive(callback) {

        log.log("Starting to cleanUpArchive please wait...");
        cleanUpTempArchive(true, callback);

        function cleanUpTempArchive(needToCallBack, cb) {

            // array of arrays for each day that we are keeping

            var today = new Date();
            today.setHours(0);
            today.setMinutes(0);
            today.setSeconds(0);
            today.setMilliseconds(0);

            var fromTodayInMS = today.getTime();
            var aDayInMS = 86400000;

            var archive = nconf.get('archive');
            var coldStorage = [];

            global._lockArchive = true;

            for (var day = settings.tempArchiveLength; day < settings.archiveDays; day++)
            {
                var aDay = {
                    name: '',
                    file: '',
                    startEPOCH: (fromTodayInMS - ((day + 1) * aDayInMS)), // oldest date
                    endEPOCH: ((fromTodayInMS - 1) - (day * aDayInMS)), // newest date
                    toArchive: [],
                    data: []
                };

                var getMonthAndDay = new Date(aDay.startEPOCH);

                aDay.name = 'archive-' + (getMonthAndDay.getMonth() + 1) + getMonthAndDay.getDate() + '.json';
                aDay.file = path.join(settings.archiveFolder, aDay.name);
                coldStorage.push(aDay);
            }
            log.log("%s Storage: %j", (new Date).toLocaleString(), coldStorage);
            var toRemove = [];

            for (var i = 0; i < archive.length; i++)
            {
                log.log("Data: %j", archive[i]);

                for (var j = coldStorage.length - 1; j >= 0; j--)
                {
                    var done = false;
                    while (done === false) {

                        if (archive[i].data.length > 0 && archive[i].data[0]) // oldest data point
                        {

                            if (archive[i].data[0].time < coldStorage[j].startEPOCH) { // data is older than we keep

                                log.log("Dropping old data from %s: %j",
                                            archive[i].server,
                                            archive[i].data.shift()
                                ); // drop data

                            } else if (archive[i].data[0].time <= coldStorage[j].endEPOCH) { // data needs to be long term archived

                                coldStorage[j].toArchive.push({  // place in coldstorage queue to be merged with current data
                                                                  server: archive[i].server,
                                                                  point:  archive[i].data.shift()
                                                              }
                                );

                            } else {
                                log.log("Server: %s with oldest data point: %s is not older than %s",
                                            archive[i].server,
                                            (new Date(archive[i].data[0].time)).toLocaleString(),
                                            (new Date(coldStorage[j].endEPOCH)).toLocaleString()
                                );
                                done = true;
                            }

                        } else if (archive[i].data[0] === null) {

                            log.log("Dropping bad data");

                            archive[i].data.shift();

                        } else {
                            done = true;
                        }

                    }
                }

                if (archive[i].data.length === 0) {
                    toRemove.unshift(i); // Pushes onto the top of the stack
                }
            }
            for (var k = 0; k < toRemove.length; k++) // this will remove old shit
            {
                archive.splice(toRemove[k],1);
            }
            nconf.set('archive', archive);

            for (var l = coldStorage.length - 1; l >= 0; l--)
            {
                if (coldStorage[l].toArchive.length > 0) {
                    coldStorage[l].data = fixFormat(coldStorage[l].toArchive);
                }
            }
            function fixFormat(toArchive) {

                // log.log("archive data");
                if (!toArchive || toArchive.length === 0) {
                    return [];
                }

                var ret = [];

                for (var m = 0; m < toArchive.length; m++) {

                    if (m === 0) {
                        ret.push({ server: toArchive[m].server, data: [ toArchive[m].point]});
                    } else {
                        var found = -1;
                        for (var n = 0; n < ret.length; n++) {
                            if (ret[n].server.toLowerCase() == toArchive[m].server.toLowerCase()) {
                                ret[n].data.push(toArchive[m].point);
                                found = n;
                            }
                        }
                        if (found === -1) {
                            ret.push({ server: toArchive[m].server, data: [ toArchive[m].point]});
                        }
                    }
                }
                return ret;
            }

            // Get the stuff from the saved files and merge them.
            async.eachSeries(coldStorage,
                 function(file, next) {
                     if (file.data == [] || file.data.length == 0) {
                         next();
                         return;
                     }
                     if (fs.existsSync(file.file)) {
                         fs.readFile(file.file, { encoding: 'utf8' }, function (err, someData) {

                             if (err) {
                                 log.warn("Error reading %s archive file", file.file);
                                 log.error(err);
                                 next();
                                 return;

                             } else {
                                 try {
                                     var newData = JSON.parse(someData);
                                     log.log("Loaded and parsed %s",file.file);
                                     combineData(file, newData);

                                 } catch (e) {
                                     log.warn("Error parsing settings.json loading default settings");
                                     log.error(e);
                                     next();
                                     return;
                                 }
                             }

                         });
                     } else {
                         writeOutFile(file);
                     }

                    function combineData(aFile, newData) {

                        for (var p = 0; p < newData.length; p++) {

                            var found = -1;
                            for (var q = 0; q < aFile.data.length; q++) {
                                if (newData[p].server.toLowerCase() == aFile.data[q].server.toLowerCase()) {

                                    for (var r = 0; r < newData[p].data.length; r++) {
                                        aFile.data[q].data.unshift(newData[p].data[r]);
                                    }
                                    found = q;
                                }
                            }
                            if (found === -1) {
                                aFile.data.push(newData[p]);
                            }
                        }
                        writeOutFile(aFile);
                    }

                    function writeOutFile(outFile) {
                        fs.writeFileSync(outFile.file, JSON.stringify(outFile.data), { encoding: 'utf8' });
                        log.log("%s Saved archived files into persistent files: %j", (new Date).toLocaleString(),outFile.file);
                        next();
                    }

                 }, function (err) {

                    nconf.save();
                    global._lockArchive = false;

                    if (needToCallBack === true) {
                        cb();
                        return;
                    }
            });
        }


    };
    // setInterval(cleanUpArchive, settings.tempArchiveLength || 172800000); // 2 days

    function checkDataFiles() {
        // TODO set up later
    };

    function fixArchive(cb) {

        var archive;

        try {

            archive = nconf.get('db:archive');

        } catch (e) {
            log.error(e);
            cb(false);
        }

        // nconf.use('data').set('db:archive', []);
        if (archive == null || archive == undefined || archive.length == null || archive.length == undefined || archive.length === 0) {

            archive = nconf.get('archive');
            if (archive == null || archive.length == null)
            {
                nconf.set('archive', []);
                cb(true);
            } else {
                log.log("Archive is in correct format starting cleanup");
                cb(true);
            }

        } else {
            log.log("Archive found in the wrong section.  Beginning to move to new location");
            nconf.set('archive', archive);
            nconf.clear('db:archive');
            nconf.save(function() {
                log.log("Moved archive over successfully Servers Found: %d", archive.length);
                cb(true);
            });
        }
    };

    function fixFronts() {
        var fronts = nconf.get('db:fronts');
        if (fronts == null || fronts == undefined || fronts.length == null || fronts.length == undefined || fronts.length === 0) {
            nconf.set('db:fronts', [{
                                                    "id": 1,
                                                    "url": "/moc",
                                                    "name": "MOC"
                                                },
                                                {
                                                    "id": 2,
                                                    "url": "/phx",
                                                    "name": "PHX"
                                                }]);
            nconf.save();
        }
    };

    function fixDataTypes() {
        var dataTypes = nconf.get('db:dataTypes');
        if (dataTypes == null || dataTypes == undefined || dataTypes === []) {
            dataTypes = [
                {
                    id: 0,
                    name: 'cpu'
                },
                {
                    id: 1,
                    name: 'mem'
                }
            ];
            nconf.set("db:dataTypes", dataTypes);
        }
    };


    function strictWrapper() {

        log.log('Slave initialized');

        // Express app
        var express = require('express');

        // nconf

        // Routes
        var routes = require('./routes');
        var dashboard = require('./routes/dashboard');
        var api = require('./routes/api');
        var report = require('./routes/report');
        // var derek = require('./routes/derek');

        // Required
        var http = require('http');
        var path = require('path');


        // Bind express and begin setting up the environment
        var app = express();

        // All environments
        app.set('port', process.env.PORT || 4000);
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'jade');

        // Connect / Express Middleware
        app.use(express.favicon(path.join(__dirname, "public/images/favicon.ico")));
        // app.use(express.logger());
        app.use(express.json());
        app.use(express.urlencoded());
        app.use(express.methodOverride());
        app.use(require('less-middleware')({ src: path.join(__dirname, 'public') }));
        app.use(express.static(path.join(__dirname, 'public')));
        app.use(app.router);

        // development only
        if ('development' == app.get('env')) {
            app.use(express.errorHandler());
        }

        // ***  Routes  ***
        //      * index main pages
        app.get('/', routes.index);
        app.get('/manage', checkAuth, routes.manage); // setup later

        //      * api calls
        app.post('/api/update', api.update);  // Servers send data
        app.post('/api/data', api.data);  // called to get data about groups of servers
        app.get('/api/data/:id', api.getData); // called from built dashboards
        app.get('/groups', api.groups); // called to get list of groups
        app.get('/servers', api.servers); // called to get list of servers
        app.get('/dashboards', api.dashboards);
        app.get('/save', api.save); // called to initiate a save
        app.get('/reload', api.reload); // called to initiate a save

        app.post('/manage', checkAuth, api.manage); // save manage stuff
        app.post('/servers/create', checkAuth, api.createServer); // create server (maybe put this back into manage)

        app.post('/manage/server', checkAuth, api.manageServer); // manage server
        app.post('/manage/group', checkAuth, api.manageGroup); // manage server
        app.post('/manage/dash', checkAuth, api.manageDash); // manage server

        // app.get('/derek', derek.app);

        app.get('/archive', api.getArchive);


        app.get('/report', report.report);
        app.post('/report', report.report);
        app.get('/custom', report.customReport);

        //      * catch everything else
        app.get('/*', dashboard.indexed);

        http.createServer(app).listen(app.get('port'), function () {
            log.log('Express server listening on port ' + app.get('port'));
            log.log("Memory usage: %j", util.inspect(process.memoryUsage()));
                                          // api.startCollector();
                                      }
        );

        setInterval(function() {
            api.saveToDisk(6);
        }, 120000);



        function checkAuth(req, res, next) {
            // everyone wins!
            next();
        }

        process.on('SIGINT', lockData);
        process.on('SIGHUP', lockData);
        process.on('SIGQUIT', lockData);
        process.on('SIGTERM', lockData);
        process.on('SIGABRT', lockData);

        function lockData() {
            nconf.use('data').set('lock', true);
            log.warn("Received Signal");
            setImmediate(process.exit());
        };
    }
}