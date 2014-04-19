/**
 * Created by Derek Rada on 4/18/2014.
 */

/**
 * Modules
 *
 */

var nconf = require('nconf');
var numUpdates = 0;
// var data = nconf.use('data');

// app.post('/api/update', api.update);
exports.update = function(req, res) {

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
        numUpdates++;
        if ((numUpdates % 50) === 0) {
            saveToDisk(0);
        }

    } catch (e) {
        res.send(500);
    }

    if (memTotal != 0) {
        mem = ((memUsed / memTotal) * 100.00);
    }

    // add data to nconf
    addServerData(server, cpu, mem);
};

function addServerData(server, cpu, mem, count) {

    var data = nconf.use('data');

    if (data.get('lock') === false || count >= 5)
    {
        data.set('lock', true);
        var servers = data.get('servers'),
            iterator,
            found,
            temp = [];

        for(iterator = 0, found = servers.length; iterator < servers.length; iterator++)
        {

            if (servers[iterator].server == server)
            {
                found = iterator;
            }
        }
        if (found === servers.length)
        {
            servers.push(
                {
                    server: server,
                    data: []
                }
            );
        }
        servers[found].data.push(
            {
                time: new Date().getTime(),
                cpu: cpu || 0.00,
                mem: mem || 0.00
            }
        );

        while (servers[found].data.length > 30)
        {
            servers[found].data.shift();
        }

        data.set('servers', servers);
        data.set('lock', false);
    } else {
        count = count || 0;
        count++;
        setTimeout(function() {
            addServerData(server, cpu, mem, count);
        }, Math.floor(Math.random() * 100))
    }
}

var saveToDisk = exports.saveToDisk = function saveToDisk (count) {

    var data = nconf.use('data');
    var count = count || 0;
    count++;

    if (data.get('lock') === false || count >= 5)
    {
        data.set('lock', true);

        cleanUpData();

        data.save(function(err) {
            if (err) {
                console.log(err);
            }
            data.set('lock', false);

        });

    } else {
        setTimeout(function() {
            saveToDisk(count);
        }, Math.floor(Math.random() * 100))
    }
};

function cleanUpData() {
    var data = data = nconf.use('data');
    var servers = data.get('servers');
    var toRemove = [];

    for(var i = 0; i < servers.length; i++)
    {
        var temp = servers[i].data;
        var done = false;

        while (done !== true)
        {
            if (temp.length > 0)
            {
                if (temp[0].time <= (new Date().getTime() - 3600000))
                {
                    servers[i].data.shift();
                } else {
                    done = true;
                }

            } else {
                done = true;
            }
        }
        if (servers[i].data.length == 0)
        {
            toRemove.push(i);
        }
    }
    for (var k = 0; k < toRemove.length; k++)
    {
        servers.splice(toRemove[k], 1);
    }
    data.set('servers', servers);
}