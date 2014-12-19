/**
 * Created by Derek Rada on 4/18/2014.
 */


/**
 * Module dependencies.
 */

var util = require('util');


var settings = require('./settings.json') || {
    "dataDirectory": "./public/data/",
    "dataFile": "data.json",
    "archiveFolder": "./public/data/",
    "tempArchiveLength": 5,
    "archiveDays": 14,
    "loglevel": 0,
    "dev": true
};

var easylogger = require('easy-logger');
var log = easylogger.startGlobal({level: settings.loglevel});
log.log("Attempting to start slave process pid: %d", process.pid);


var path = require('path');
// var nconf = require('nconf');
var async = require('async');
var controller = require('./DataController/controller');

controller.cleanConfig(function() {

    log.debug("Cleaned config called back");
    strictWrapper();

});




function strictWrapper() {

    // Express app
    var express = require('express');

    // nconf

    // Routes
    var routes = require('./routes');
    var dashboard = require('./routes/dashboard');
    var api = require('./routes/api');
    var report = require('./routes/report');
    var manage = require('./routes/manage');
    // var derek = require('./routes/derek');

    // Required
    var http = require('http');
    var path = require('path');


    // Bind express and begin setting up the environment
    var app = express();

    // All environments
    app.set('port', settings.port || 4000);
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');
    app.enable('trust proxy');

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
    app.get('/manage', checkAuth, manage.index); // setup later

    // *** API Calls ***
    app.post('/api/update', api.update2);  // Servers send data
    app.post('/api/data', api.data2);  // called to get data about groups of servers
    app.get('/api/current', api.current);

    // *** Legacy Dashboard call ***
    app.get('/api/data/:id', api.getData2); // called from built dashboards

    app.get('/api/db/:id', api.getDB); // get all db info by version


    // *** RESTful API ***
    app.get('/api/groups', manage.groups); // called to get list of groups
    app.get('/api/servers', manage.servers); // called to get list of servers
    app.get('/api/dashboards', manage.dashboards); // called to get dashboards

    app.all('/api/dashboard/:id', manage.dashboard); // called to get / update / delete / create dashboard
    app.all('/api/server/:id', manage.server); // called to get / update / delete / create server
    app.all('/api/group/:id', manage.group); // called to get / update / delete / create group


    app.get('/save', api.save); // called to initiate a save
    app.get('/reload', api.reload); // called to initiate a save


    // Legacy not restful
    app.post('/servers/create', checkAuth, api.createServer); // create server (maybe put this back into manage)
    app.post('/manage', checkAuth, api.manage); // save manage stuff
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
        // nconf.use('data').set('lock', true);
        log.warn("Received Signal");
        setImmediate(process.exit());
    };
}
