/**
 * Created by Derek Rada on 5/9/2014.
 */

var nconf = require('nconf');
var util = require('util');
var log = require('easy-logger').logger();
var controller = require('../DataController/controller.js');

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

            log.log(e);
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


    log.log("Starting report for: " + numStart + " - " + numEnd);

    var servers = getServerIds(req.body.servers);
    var config = {
        startTime: numStart,
        endTime: numEnd,
        servers: servers
    };
    controller.getData(config, function (err, reportData) {

        if (err) {
            res.send(err);
        } else {

            if (true/* req.param('json') == 1 */)
            {
                log.debug("Report output: %j", reportData);
                res.json(
                    {
                        start: numStart,
                        end: numEnd,
                        data: reportData.data
                    }
                );
            } else {
                res.render('report', output);
            }

        }
    });


    /*
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
    */
};

function getServerIds(servers) {

    var ret = [];

    for (var i = 0; servers && i < servers.length; i++) {
        var tmp = { hostName: servers[i], id: 0 };
        tmp.id = controller.getServerId(tmp);
        if (tmp.id) {
            ret.push(tmp.id);
        }
    }
    return ret;
}


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


exports.customReport = function(req, res) {

    var db = controller.db();

    res.render('customReport', {
        servers: sortServerById(db.servers),
        dataTypes: db.dataTypes
    });

};

function sortServerById(servers) {
    var servers = servers || [];
    return servers.sort(function (a, b) {
        return a.id - b.id;
    });
};