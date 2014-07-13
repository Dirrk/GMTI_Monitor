/**
 * Created by Derek Rada on 4/18/2014.
 */

var nconf = require('nconf');
var util = require('util');
var log = require('easy-logger').logger();
var controller = require('../DataController/controller.js');
/*
//      * moc dashboards
app.get('/moc', dashboard.mocIndex);
app.get('/moc/:id', dashboard.mocDashboard);

//      * phx dashboards
app.get('/phx', dashboard.phxIndex);
app.get('/phx/:id', dashboard.phxDashboard);

*/

exports.indexed = function (req, res) {

    // either load a front / dashboard or 404
    var url = req.url.toLowerCase().split('?')[0];

    log.info(url);
    var front = getFrontByURL(url);


    if (front !== null) {


        if (url.lastIndexOf('/') === 0) // at a front
        {

            loadDashIndex(front, res);

        } else {

            var dashId = url.substr(url.lastIndexOf('/') + 1);
            var dashboard = getDashboardById(dashId);
            if (dashboard !== null) {

                loadDashboard(front, dashboard, res, req.param('view'));

            } else {

                res.send(404);
            }

        }

    } else {

        res.send(404);
    }

};


function getFrontByURL(url) {

    var fronts = controller.db().fronts;
    for (var i = 0; i < fronts.length; i++) {
        if (url.indexOf(fronts[i].uri) >= 0) {
            return fronts[i];
        }
    }
    return null;
}

function getDashboardById(id) {

    var dashboards = controller.db().dashboards || [];
    for (var i = 0; i < dashboards.length; i++)
    {
        if (dashboards[i].uri.toLowerCase() == id.toLowerCase())
        {
            return dashboards[i];
        }
    }
    return null; // return the test devices
}

function loadDashIndex(front, res) {

    try {
        var data = {
            front: front,
            dashboards: []
        };
        var dashes = controller.db().dashboards;
        for (var i = 0; i < dashes.length; i++)
        {
            if (dashes[i].front == front.id)
            {
                data.dashboards.push(dashes[i]);
            }
        }
        res.render(front.template, data);
    } catch (e) {
        log.log(e);
        try {
            res.send(500);
        } catch (ignore) {
            log.log("WARN: loadDashIndex Already sent cannot resend");
        }
    }

};

function loadDashboard(front, dashboard, res, params) {

    try {

        var data = {

            front: front,
            dashboard: dashboard,
            barFormat: params || front.barFormat || 'cpu'

        };
        if (params) {
            log.info("params: %j", params);
        }

        res.render(dashboard.template, data);

    } catch (e) {
        log.log(e);
        try {
            res.send(500);
        } catch (ignore) {
            log.log("WARN: loadDashboard Already sent cannot resend");
        }
    }


}