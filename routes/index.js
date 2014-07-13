/**
 * Created by Derek Rada on 4/18/2014.
 */

/**
 * Index of main page
 * @type {exports}
 */
var os = require('os'),
    host = os.hostname(),
    nconf = require('nconf'),
    controller = require('../DataController/controller.js');


exports.index = function(req, res){

  var fronts = controller.db().fronts;

  res.render('index',
             {
                 computer: host,
                 fronts: fronts
             }
  );
};

exports.manage = function (req, res) {

    res.render('manage');

};