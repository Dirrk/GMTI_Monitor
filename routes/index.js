/**
 * Created by Derek Rada on 4/18/2014.
 */

/**
 * Index of main page
 * @type {exports}
 */
var os = require('os'),
    host = os.hostname();

exports.index = function(req, res){
  res.render('index',
             {
                 computer: host
             }
  );
};