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
        var noc = require('./routes/noc');
        var api = require('./routes/api');

        // Required
        var http = require('http');
        var path = require('path');

        // Custom
        var nconf = require('nconf');


        // Load nconf files or fail

        nconf.add('data', {type: 'memory'});
        var readData = require('./public/data/test.json');
        nconf.use('data').set('servers:', readData.servers);

        // Bind express and begin setting up the environment
        var app = express();

        // All environments
        app.set('port', process.env.PORT || 4000);
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'jade');

        // Connect / Express Middleware
        app.use(express.favicon(path.join(__dirname, "public/images/favicon.ico")));
        app.use(express.logger('dev'));
        app.use(express.json());
        app.use(express.urlencoded());
        app.use(express.methodOverride());
        app.use(app.router);
        app.use(require('less-middleware')({ src: path.join(__dirname, 'public') }));
        app.use(express.static(path.join(__dirname, 'public')));

        // development only
        if ('development' == app.get('env')) {
            app.use(express.errorHandler());
        }

        // API / Routes
        app.get('/', routes.index);
        app.get('/noc', noc.index);
        app.get('/noc/ux', noc.uxDashboard);
        app.get('/api/noc/ux', noc.uxData);
        app.post('/api/update', api.update);


        http.createServer(app).listen(app.get('port'), function () {
            console.log('Express server listening on port ' + app.get('port'));
            }
        );
    }
}