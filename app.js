/**
 * Created by Derek Rada on 4/18/2014.
 */


/**
 * Module dependencies.
 */

var cluster = require('cluster'),
    slave;

/**
 *  Master process
 */

if (cluster.isMaster)
{

    console.log("Master started: " + (new Date).toLocaleString());
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


    var nconf = require('nconf');
    nconf.add('data', {type: 'file', file: './public/data/data.json', loadSync: true });
    nconf.use('data').set('lock', false);

    var settings = require('./settings.json');

    // Setup before allowing slave to even start

    // fix nconf setups

    startSlave();
    function startSlave() {

        fixFronts();

        fixArchive(function (val) {
            if (val === true) {
                strictWrapper();
            }
        });
    };

    function checkDataFiles() {
        // TODO set up later
    };

    function fixArchive(cb) {

        var archive;

        try {

            archive = nconf.get('db:archive');

        } catch (e) {
            console.error(e);
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
                console.log("Archive is in correct formats starting cleanup");
                cb(true);
            }
        } else {
            console.log("Archive found in the wrong section.  Beginning to move to new location");
            nconf.set('archive', archive);
            nconf.clear('db:archive');
            nconf.save(function() {
                console.log("Moved archive over successfully Servers Found: %d", nconf.get('archive').length);
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



    function strictWrapper() {
        "use strict";

        console.log('Slave initialized');

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

        //      * catch everything else
        app.get('/*', dashboard.indexed);

        http.createServer(app).listen(app.get('port'), function () {
            console.log('Express server listening on port ' + app.get('port'));
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
            console.log("Received Signal");
            setImmediate(process.exit());
        };
    }
}