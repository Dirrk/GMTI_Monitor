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
    slave = cluster.fork();

    cluster.on('exit', function(deadSlave, code, signal) {
        console.log('Slave %d died with code/signal (%s). Restarting slave ', deadSlave.id, signal || code);
        slave = cluster.fork(); // create new slave
    });

}
/**
 *  Slave process
 *  Use strict function because I like clean code and do not want to contaminate this level
 */

else {

    strictWrapper();
    function strictWrapper() {
        "use strict";

        console.log('Slave initialized');

        // Express app
        var express = require('express');

        // Routes
        var routes = require('./routes');
        var dashboard = require('./routes/dashboard');
        var api = require('./routes/api');
        var derek = require('./routes/derek');

        // Required
        var http = require('http');
        var path = require('path');

        // Custom
        var nconf = require('nconf');


        // Load nconf files or fail
        nconf.add('data', {type: 'file', file: './public/data/data.json', loadSync: true });
        nconf.add('db', {type: 'file', file: './public/data/servers.json', loadSync: true });
        nconf.use('data').set('lock', false);
        console.log(nconf.get("db"));

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

        app.get('/derek', derek.app);

        //      * catch everything else
        app.get('/*', dashboard.indexed);

        http.createServer(app).listen(app.get('port'), function () {
            console.log('Express server listening on port ' + app.get('port'));
            }
        );

        setInterval(function() {
            api.saveToDisk(0);
        }, 120000);

        function checkAuth(req, res, next) {
            // everyone wins!
            next();
        }
    }
}