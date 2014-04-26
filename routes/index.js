/**
 * Created by Derek Rada on 4/18/2014.
 */

/**
 * Index of main page
 * @type {exports}
 */
var os = require('os'),
    host = os.hostname(),
    nconf = require('nconf');


exports.index = function(req, res){

  var fronts = nconf.get('db:fronts');

  res.render('index',
             {
                 computer: host,
                 fronts: fronts
             }
  );
};

exports.manage = function (req, res) {

    res.send("Good job");

};