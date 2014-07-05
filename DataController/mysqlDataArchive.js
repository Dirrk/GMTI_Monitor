/**
 * Created by Derek Rada on 6/7/2014.
 */


var mysql = require('mysql');
var settings = require('./../settings.json');
var log = require('easy-logger').logger();
var controller = require('./controller');


var pool = mysql.createPool(settings.mysql);
var _sock;


exports.sock = function (sock) {
  _sock = sock;
  handleData(_sock);
};

exports.getDataByServers = function getDataByServers (options, callback) {

    var options = options || {};
    options.start = options.start || ((new Date()).getTime() - 3600000);
    options.end = options.end || (new Date()).getTime();
    options.servers = options.servers || [];


    var query =
        "SELECT servers.serverId, servers.serverName, collections.collectionId, collections.dateTime, dataTypes.dataTypeField, dataTypes.dataTypeJs, dataTypes.dataTypeName, collectionDetails.collectionData " +
        "FROM servers " +
            "INNER JOIN collections " +
                "ON servers.serverId = collections.serverId " +
            "INNER JOIN collectionDetails " +
                "ON collections.collectionId = collectionDetails.collectionId " +
            "INNER JOIN dataTypes " +
                "ON collectionDetails.dataTypeId = dataTypes.dataTypeId " +
        "WHERE collections.dateTime >= ? AND collections.dateTime <= ?";

    if (options.servers.length > 0) {

        for (var i = 0; i < options.servers.length; i++) {
            if (i == 0) {
                query += " AND (";
            } else {
                query += " OR "
            }
            query += "servers.serverId=" + options.servers[i];
        }
        query += ");"
    } else {
        query += ";"
    }

    getFromSQL(mysql.escape(query, [options.start, options.end]), function(err, results) {
            if (results) {
                log.log("Results: ", results);
                callback(results);
            } else {
                log.error(err);
                callback(err);
            }
    });
};


exports.importServerData = function (data, callback) {


};


var getFromSQL = function(query, cb) {

    pool.getConnection(function (err, connection) {

        if (err) {
            next(err);
        } else {

            connection.query(query, function (err, results) {

                if (err || !results) {
                    log.err(err);
                    cb(err);

                } else {

                    log.debug(results);
                    cb(null, results);
                }
            });
        }
    });

};


function handleData(sock) {


    sock.on('newData', function(serverId, values) {

        log.debug("Handle Data: %d with %j", serverId, values);

    });


};

