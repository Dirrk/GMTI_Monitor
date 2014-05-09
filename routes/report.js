/**
 * Created by Derek Rada on 5/9/2014.
 */

var nconf = require('nconf');

exports.report = function(req, res) {


    var start = new Date();
    var end = new Date();

    start.setHours(new Date().getHours() - 1);
    start.setMinutes(0);
    start.setSeconds(0);

    end.setMinutes(0);
    end.setSeconds(0);

    var numStart = start.getTime();
    var numEnd = end.getTime();

    var reportData = [];
    var servers = nconf.use('data').get('db:archive');
    for (var i = 0; i < servers.length; i++) {

        reportData.push({
            server: servers[i].server,
            data: []
        });

        for (var j = 0; j < servers[i].data.length; j++) {

            if (servers[i].data[j].time >= numStart && servers[i].data[j].time < numEnd)
            {
                reportData[i].data.push(servers[i].data[j]);
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
        start: start.toTimeString(),
        end: end.toTimeString(),
        data: sortServers(reportData)
    };


    if (req.param.json && req.param.json === true)
    {

        res.json(output);

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