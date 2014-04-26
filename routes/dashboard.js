/**
 * Created by Derek Rada on 4/18/2014.
 */

var nconf = require('nconf');
var util = require('util');
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
    var url = req.url.toLowerCase();
    console.log("url: " + url);

    var front = getFrontByURL(url);

    if (front !== null) {

        if (url.lastIndexOf('/') === 0) // at a front
        {

            loadDashIndex(front, res);

        } else {

            var dashId = url.substr(url.lastIndexOf('/') + 1);
            var dashboard = getDashboardById(dashId);
            if (dashboard !== null) {

                loadDashboard(front, dashboard, res);

            } else {

                res.send(404);
            }

        }

    } else {

        res.send(404);
    }

};


exports.mocIndex = function(req, res) {

    loadDashIndex(
        {
              "id": 1,
              "url": "/moc",
              "name": "MOC"
        },

        res
    );


};

exports.phxIndex = function(req, res) {

    loadDashIndex(
        {
            "id": 2,
            "url": "/phx",
            "name": "PHX"
        },

        res
    );

};

exports.mocDashboard = function (req, res) {

    loadDashboard(getFrontByURL('/moc'), getDashboardById('moc_aime_ux'), res);

};

exports.phxDashboard = function (req, res) {
    res.render('dashboard', {
        id: "phx_aime_ux",
        front: 'PHX',
        name: "AIME UX",
        description: "nginx/uWSGI front end servers.  CPU/Memory data",
        groups: [2]
    });
};


exports.index = function(req, res) {
    res.render('nocIndex');
};

// app.get('/noc/ux', noc.uxDashboard);
exports.uxDashboard = function(req, res) {
    res.render('uxDashboard');
};


function getFrontByURL(url) {
    var fronts = nconf.get("db:fronts");
    for (var i = 0; i < fronts.length; i++) {
        if (url.indexOf(fronts[i].url) >= 0) {
            console.log("Front found: " + util.inspect(fronts[i]));
            return fronts[i];
        }
    }
    return null;
}

function getDashboardById(id) {

    var dashboards = nconf.get("db:dashboards") || [];
    for (var i = 0; i < dashboards.length; i++)
    {
        if (dashboards[i].id.toLowerCase() == id.toLowerCase())
        {
            console.log("ID found: " + id);
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
        var dashes = nconf.get('db:dashboards');
        for (var i = 0; i < dashes.length; i++)
        {
            if (dashes[i].front == front.id)
            {
                data.dashboards.push(dashes[i]);
            }
        }
        res.render('dashIndex', data);
    } catch (e) {
        console.log(e);
        try {
            res.send(500);
        } catch (ignore) {
            console.log("Already sent");
        }
    }

};

function loadDashboard(front, dashboard, res) {

    try {

        console.log("Load dashboard: front, dashboard ");
        console.log(util.inspect(front));
        console.log(util.inspect(dashboard));

        var data = {

            front: front,
            dashboard: dashboard

        };

        res.render('dashboard', data);

    } catch (e) {
        console.log(e);
        try {
            res.send(500);
        } catch (ignore) {
            console.log("Already sent");
        }
    }


}