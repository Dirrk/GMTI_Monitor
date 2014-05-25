/**
 * Created by Derek Rada on 5/9/2014.
 */

var nconf = require('nconf').use('data');
var util = require('util');

exports.report = function(req, res) {


    var start = new Date();
    var end = new Date();
    var numStart;
    var numEnd;

    if (req.body.start) {
        try {
            numStart = parseInt(req.body.start);
            start = new Date(0);
            start.setUTCMilliseconds(numStart);
            if (req.body.end) {
                numEnd = parseInt(req.body.end);
            } else {
                numEnd = new Date().getTime();
            }

            end = new Date(0);
            end.setUTCMilliseconds(numEnd);

        } catch (e) {

            console.log(e);
            res.send(500, "Invalid date request");
            return;
        }

    } else {

        start.setHours(new Date().getHours() - 1);
//        start.setMinutes(0);
//        start.setSeconds(0);

//        end.setMinutes(0);
//        end.setSeconds(0);
        numStart = start.getTime();
        numEnd = end.getTime();
    }


    console.log("Starting report for: " + numStart + " - " + numEnd);

    var reportData = [];
    var servers = combinedServers(req.body);
    for (var i = 0; i < servers.length; i++) {

        reportData.push({
            server: servers[i].server,
            data: []
        });

        for (var j = 0; j < servers[i].data.length; j++) {

            if (servers[i].data[j].time >= numStart && servers[i].data[j].time < numEnd)
            {
                // console.log("Adding data");
                reportData[i].data.push(servers[i].data[j]);
            } else {
                // console.log("Invalid time: " + servers[i].data[j].time);
            }
        }
    }

    var toRemove = [];
    for (var i = 0; i < reportData.length; i++) {

        var totalCPU = 0;
        var totalMem = 0;
        var lowCPU = 100;
        var highCPU = 0;
        var lowMem = 100;
        var highMem = 0;
        for (var j = 0; j < reportData[i].data.length; j++) {

            totalCPU += reportData[i].data[j].cpu;
            totalMem += reportData[i].data[j].mem;

            if (lowCPU > reportData[i].data[j].cpu) {
                lowCPU = reportData[i].data[j].cpu;
            }
            if (lowMem > reportData[i].data[j].mem) {
                lowMem = reportData[i].data[j].mem;
            }
            if (highCPU < reportData[i].data[j].cpu) {
                highCPU = reportData[i].data[j].cpu;
            }
            if (highMem < reportData[i].data[j].mem) {
                highMem = reportData[i].data[j].mem;
            }
        }
        if (reportData[i].data.length > 0)
        {
            reportData[i].averageCPU = Math.floor((totalCPU / reportData[i].data.length) * 1000) / 1000;
            reportData[i].averageMem = Math.floor((totalMem / reportData[i].data.length) * 1000) / 1000;
            reportData[i].lowCPU = Math.floor((lowCPU) * 1000) / 1000;
            reportData[i].highCPU = Math.floor((highCPU) * 1000) / 1000;
            reportData[i].lowMem = Math.floor((lowMem) * 1000) / 1000;
            reportData[i].highMem = Math.floor((highMem) * 1000) / 1000;

        } else {
            toRemove.push(i);
        }
    }

    // res.write('Start: ' + start.toTimeString());
    // res.write('End: ' + end.toTimeString());
    var output = {
        start: start.toDateString() + " " + start.toTimeString(),
        end: end.toDateString() + " " + end.toTimeString(),
        data: sortServers(reportData)
    };

    if (req.param('json') == 1)
    {
        console.log("Output: %j", output.data);
        try {
            res.json(output);
        } catch (e) {
            console.log(e);
            try {
                res.send(500);
            } catch (ignore) {
                console.log("Couldn't send 500 it was already sent");
            }
        }

    } else {
        res.render('report', output);
    }
};


function sortServers(servers) {

    return servers.sort(function (a, b) { // sort before saving
        if (a.server < b.server)
        {
            return -1;
        } else if (a.server > b.server) {
            return 1;
        } else {
            return 0;
        }

    });
}

function combinedServers(body) {

    console.log("POST Report: %j", body);

    if (body && body.servers && body.servers.length > 0)
    {

        var archived = nconf.get('archive');
        var ret = [];

        for (var i = 0; i < archived.length; i++)
        {
            for (var j = 0; j < body.servers.length; j++)
            {
                if (archived[i].server == body.servers[j]) {

                    ret.push(archived[i]);
                    // console.log("Found: " + archived[i].server);
                    // console.log(util.inspect(archived[i].data));

                }
            }
        }

        return ret;


    } else if (body && body.start && body.end) {

        // console.log("Archive request");
        return nconf.get('archive');

    } else {
        // console.log("Current request");
        var current = nconf.get('servers');
        return current;
    }


    // var archived = nconf.use('data').get('archive');

    /*
    var combined = [];

    var addlater = [];

    if (current.length >= archived.length) {
        combined = current;
    } else {
        combined = archived;
    }
    for (var i = 0; i < combined.length; i++)
    {
        var found = -1;
        for (var j = 0; j < current.length; j++)
        {

            if (current[j].server == combined[i].server) {
                found = i;
                // combine here based on which one needs to be first ie current.data should always be first
            }
        }
        addlater.push(i);
    }

    */
}