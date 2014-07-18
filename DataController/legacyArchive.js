/**
 * Created by Derek Rada on 6/29/2014.
 */
// Seperating the old archiving method from the new sql one.
// In the future I hope this application will have multiple modes but this current one is flawed so I need to seperate everything and fix the kinks before moving on.
// this should make swapping datacontrollers out easier plus improve on the older version.

// quick and dirty way of doing this would be to change settings to keep 1 day of archive

var nconf = require('nconf');
var debug = false;
var async = require('async');
var log = require('easy-logger').logger();
var fs = require('fs');
var path = require('path');
var controller = require('./controller');
var settings = require('../settings');
var _sock;
var util = require('util');

/**
 * LegacyController Settings
 *
 * JSON
 */

var legacySettings = settings.legacySettings || {};

legacySettings.currentLength = legacySettings.currentLength || settings.currentLength || 3600000; // 1 hour
legacySettings.currentCleanupFrequency = legacySettings.currentCleanupFrequency || 120000; // 2 minutes
legacySettings.throttleDB = legacySettings.throttleDB || 15000; // 15 seconds
legacySettings.forceSaveDB = legacySettings.forceSaveDB || 900000; // 15 minutes



/**
 *  Save current data to disk
 *
 * @type {save}
 * @param count
 *
 */

exports.sock = function (sock) {
    _sock = sock;

    handleData(_sock);
    registerDBSync(_sock);
    startTimers();

};

exports.fixArchive = function (cb) {

    var archive = nconf.get("archive");
    var servers = controller.db().servers || [];
    log.warn(servers);
    for (var i = 0; i < servers.length; i++) {

        for (var j = 0; j < archive.length; j++)
        {
            if (archive[j].server.toLowerCase() == servers[i].server.toLowerCase()) {
                archive[j].id = servers[i].id;
                log.warn("Found Archive server: %s with an id of %d", archive[j].server, archive[j].id);
            }
        }
    }
    var toRemove = [];
    for (var k = 0; k < archive.length; k++)
    {
        if (!archive[k].id) {
            toRemove.unshift(k);
        }
    }
    for (var m = 0; m < toRemove.length; m++)
    {
        archive.splice(toRemove[m], 1);
    }
    nconf.set("archive", archive);

    cleanUpArchiveLegacy(function () {
        log.warn("Cleaned up Legacy Archive data");
        cb();
    });
};

exports.save = function saveToDisk (count) {

    return;

    var count = count || 0;
    count++;

    if (controller.lock() || count >= 5)
    {
        if (count == 5)
        {
            log.warn("Force Saving data to disk");
        }

        controller.lock(-1);

        cleanUpData(function () {

            nconf.save(function(err) { // then data
                if (err) {
                    log.error(err);
                }
                log.log("Saved successfully");
                controller.lock(0);
            });

        });

    } else {
        setTimeout(function() {
            saveToDisk(count);
        }, Math.floor(Math.random() * 100))
    }
};


/*

    DB Functions
 */

var __dbSyncStatus = new Date().getTime();
var __dbSyncNeeded = false;
var __DB_LOCK = false;

function registerDBSync(_sock) {

    _sock.on('dbChanged', function dbChangedSocketHandler(db) {

        handleMergeDB(db, function handleMergeDBCallBack(err) {

            if (err && err != 'wait') {
                log.error("Could not merge db");
                log.error(err);
            } else if (err == 'wait') {

                log.debug("Wait received, db is locked");

            } else {
                log.info("Synced database");
            }

        });
    });
};

function handleDBSyncInterval() {

    if (__dbSyncNeeded === true && __DB_LOCK === false)
    {
        saveDB(controller.db(), function (err, db) {

            if (err || db == null) {
                log.error("DB Interval failed to save data, this message will repeat until it saves successfully");
                log.error(err);

            } else {
                __dbSyncNeeded = false;
                log.info("Needed sync was performed successfully db: %j", { db: Object.keys(db) });
            }
        });
    } else if (__dbSyncStatus + legacySettings.forceSaveDB < new Date().getTime()){

        saveDB(controller.db(), function (err, db) {

            if (err || db == null) {
                log.error("DB Interval failed to save data, this message will repeat until it saves successfully");
                log.error(err);
            } else {

                log.info("Needed sync was performed successfully db: %j", { db: Object.keys(db) });
            }
        });
    } else {
        log.trace("No changes made to db");
    }

};

var loadDB = exports.loadDB = function (callback) {

    if (typeof callback === 'function') {
        handleLoadDB(callback);
    } else {
        handleLoadDB(function (db) {
            _sock.emit("dbLoaded", db);
        });
    }


};

var saveDB = exports.saveDB = function saveDB(db, callback) {

  if (typeof db === 'object' && typeof callback === 'function')
  {
      handleSaveDB(db, callback);

  } else if (typeof db === 'function') {

      handleSaveDB(controller.db(), db);

  } else if (typeof db === 'object') {

      handleSaveDB(db, function (err, newDB) {
          log.info("Saved DB without a callback");
          if (!err) {
              _sock.emit("dbSaved", newDB);

          } else {
              log.error("DB didn't save");
              log.error(err);
          }
      });

  } else {
      handleSaveDB(controller.db(), function (err, newDB) {
          log.warn("Saved DB without providing any data.  This shouldn't have happened.");
          if (!err) {
              _sock.emit("dbSaved", newDB);

          } else {
              log.error("DB didn't save");
              log.error(err);
          }
      });
  }

};


function handleMergeDB(changes, callback) {

    if (__DB_LOCK !== false || (__dbSyncStatus + legacySettings.throttleDB) >= new Date().getTime()) {

        __dbSyncNeeded = true;
        callback('wait');

    } else {

        log.debug("Merge DB requested: %j", changes);

        handleSaveDB(controller.db(), callback);
    }
};

function handleLoadDB(callback) {

    var callback = callback;

    var file = path.join(settings.dataDirectory, settings.dbFile);

    if (__DB_LOCK === false) {

        readInJSON(file, function (data) {

            if (data) {

                callback(null, data);

            } else {
                callback(new Error("Could not open DB file %s", file));
            }

        });

    } else {

        log.warn("Registering for db sync");

        _sock.once("dbUnlocked", function () {

            handleLoadDB(callback);
        });
    }


};

function handleSaveDB(db, callback) {

    var db = db || controller.db();

    if (Object.keys(db).length === 0) {
        callback(new Error("Cannot save blank database object"));
        return;
    }

    var callback = callback;

    if (__DB_LOCK === false) {

        var file = path.join(settings.dataDirectory, settings.dbFile);

        writeOutJSON(file, db, 3, function writeOutSaveDBCallback(success) {
            __DB_LOCK = false;
            if (success === true) {

                __dbSyncStatus = new Date().getTime();
                callback(null, db);

            } else {

                callback(new Error("Could not save DB file %s", file), null);
            }
            log.debug("Database file is no longer locked");
            _sock.emit("dbUnlocked");
        });
    } else {

        _sock.once("dbUnlocked", function waitForDbUnlock() {

            log.debug("Database file was locked but _sock says it is now unlocked");
            handleSaveDB(db, callback);
        });

    }

};


/*

    Managing Current

 */

function cleanUpData(cb) {

    // if (debug === true) { return };

    // var servers = nconf.get("servers");
    var servers = controller.current();
    var toRemove = [];
    var toArchive = [];

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
                    log.trace("Sending to archive");
                    var newArch = {
                        server: servers[i].server,
                        point: servers[i].data.shift()
                    };
                    log.trace("Sending to archive: %j", newArch);
                    toArchive.push(newArch);

                } else {
                    done = true;
                }

            } else {
                done = true;
            }
        }
    }

    if (toArchive.length > 0) {

        log.log("Archiving %d objects", toArchive.length);
        log.trace("Archiving: %j", toArchive);

        var archiveServers = [];

        if (fs.existsSync(path.join(settings.dataDirectory, settings.archiveFile))) {
            fs.readFile(path.join(settings.dataDirectory, settings.archiveFile), { encoding: 'utf8' }, function(err, data) {
                var data1 = [];
                try {
                    data1 = JSON.parse(data);
                } catch (e) {
                    log.error("Couldn't parse archive file.  Removing data");
                }
                archiveData(data1, toArchive, cb);
            });
        } else {
            archiveData([], toArchive, cb);
        }

    } else if (cb) {
        cb();
    } else {
        log.error("Should not happen ever");
    }
};

function archiveData(archiveServers, toArchive, cb) {

    log.trace("archive data");
    if (!toArchive || toArchive.length === 0 || !archiveServers || archiveServers.length === undefined || archiveServers.length === null) {

        log.warn("ArchiveData failed because the variables were not ready");
        cb();
        return;

    } else {

        log.trace("Length: " + archiveServers.length);
        log.trace("Incoming: %j", toArchive);
        var a = 0;
        var b = 0;

        async.eachSeries(archiveServers,

                         function (archivedServer, next) {

                             var found = [];
                             log.trace("%s :: %s", (new Date()).toLocaleString(), archivedServer.server);

                             for (var j = 0; j < toArchive.length; j++)
                             {
                                 if (archivedServer.server.toLowerCase() == toArchive[j].server.toLowerCase()) {

                                     archivedServer.data.push(toArchive[j].point);

                                     log.trace("Archived len=%d: " + archivedServer.server.toLowerCase() + " vs toArchive (%d): " + toArchive[j].server.toLowerCase() + " succeeded", archivedServer.data.length, j);
                                     a++;

                                     found.unshift(j);
                                 }
                             }
                             if (found.length >= 0) { // was found
                                 // This accounts for multiple archives added from the same host.

                                 log.trace("%s :: Before found Archive Length: %d",(new Date()).toLocaleString(), toArchive.length);
                                 log.trace("Found: %d", found.length);
                                 for (var h = 0; h < found.length; h++)
                                 {
                                     toArchive.splice(found[h], 1); // splice works on the archive
                                     log.trace("After splice Archive Length: %d", toArchive.length);
                                     b++;
                                 }
                                 setImmediate( function () {
                                     next();
                                 });

                             } else {
                                 next();
                             }
                         },
                         function (err) {
                             if (err) { log.warn("Unknown error in each series"); }
                             else {

                                 if (a !== b) {
                                     log.warn("%s :: finished A=%d :: B=%d", (new Date()).toLocaleString(), a, b);
                                 }

                                 if (toArchive.length > 0) {
                                     log.warn("Adding new servers to archive: %j", toArchive);
                                     var newCombined = combineNewServers(toArchive);

                                     for (var k = 0; k < newCombined.length; k++) {
                                         archiveServers.push(newCombined[k]);
                                     }
                                 } else {
                                     log.info("No new servers added to archive");
                                 }


                                 fs.writeFile(path.join(settings.dataDirectory, settings.archiveFile),
                                              JSON.stringify(archiveServers),
                                              { encoding: 'utf8' },
                                              function (err) {
                                                  if (!err) {
                                                      log.info("Successfully archived to files");
                                                  } else {
                                                      log.error(err);
                                                  }
                                              }
                                 );

                                 if (Math.floor(Math.random() * 720) < 12) {
                                     cleanUpArchive(cb);
                                 } else {
                                     setImmediate(function () {
                                         cb();
                                     }
                                     );
                                 }
                             }

                             clearArchiveFromCurrent(toArchive);


                         }





        );
    }
};

// This is called after fixArchive.  It adds .id to all legacy info
// flushes anything old and creates a new archive.json with the current "archive"
function cleanUpArchiveLegacy(callback) {

    log.log("Starting to cleanUpArchive please wait...");
    cleanUpTempArchive(true, callback);

    function cleanUpTempArchive(needToCallBack, cb) {

        // array of arrays for each day that we are keeping

        var today = new Date();
        today.setHours(0);
        today.setMinutes(0);
        today.setSeconds(0);
        today.setMilliseconds(0);

        var fromTodayInMS = today.getTime();
        var aDayInMS = 86400000;

        var archive = nconf.get('archive');
        var coldStorage = [];

        global._lockArchive = true;

        for (var day = settings.tempArchiveLength; day < settings.archiveDays; day++)
        {
            var aDay = {
                name: '',
                file: '',
                startEPOCH: (fromTodayInMS - ((day + 1) * aDayInMS)), // oldest date
                endEPOCH: ((fromTodayInMS - 1) - (day * aDayInMS)), // newest date
                toArchive: [],
                data: []
            };

            var getMonthAndDay = new Date(aDay.startEPOCH);

            aDay.name = 'archive-' + (getMonthAndDay.getMonth() + 1) + getMonthAndDay.getDate() + '.json';
            aDay.file = path.join(settings.archiveFolder, aDay.name);
            coldStorage.push(aDay);
        }
        log.log("%s Storage: %j", (new Date).toLocaleString(), coldStorage);
        var toRemove = [];

        for (var i = 0; i < archive.length; i++)
        {
            log.log("Data: %j", archive[i]);

            for (var j = coldStorage.length - 1; j >= 0; j--)
            {
                var done = false;
                while (done === false) {

                    if (archive[i].data.length > 0 && archive[i].data[0]) // oldest data point
                    {

                        if (archive[i].data[0].time < coldStorage[j].startEPOCH) { // data is older than we keep

                            log.trace("Dropping old data from %s: %j",
                                      archive[i].server,
                                      archive[i].data.shift()
                            ); // drop data

                        } else if (archive[i].data[0].time <= coldStorage[j].endEPOCH) { // data needs to be long term archived

                            coldStorage[j].toArchive.push({  // place in coldstorage queue to be merged with current data
                                                              server: archive[i].server,
                                                              id: archive[i].id,
                                                              point:  archive[i].data.shift()
                                                          }
                            );

                        } else {
                            log.trace("Server: %s with oldest data point: %s is not older than %s",
                                      archive[i].server,
                                      (new Date(archive[i].data[0].time)).toLocaleString(),
                                      (new Date(coldStorage[j].endEPOCH)).toLocaleString()
                            );
                            done = true;
                        }

                    } else if (archive[i].data[0] === null) {

                        log.log("Dropping bad data");

                        archive[i].data.shift();

                    } else {
                        done = true;
                    }

                }
            }

            if (archive[i].data.length === 0) {
                toRemove.unshift(i); // Pushes onto the top of the stack
            }
        }
        for (var k = 0; k < toRemove.length; k++) // this will remove old shit
        {
            archive.splice(toRemove[k],1);
        }
        nconf.clear('archive');

        fs.writeFile(path.join(settings.dataDirectory, settings.archiveFile), JSON.stringify(archive), { encoding: 'utf8' }, function (err) {
            if (!err) {
                log.info("Successfully moved legacy data to archived file");
            } else {
                log.error(err);
            }
        });


        for (var l = coldStorage.length - 1; l >= 0; l--)
        {
            if (coldStorage[l].toArchive.length > 0) {
                coldStorage[l].data = fixFormat(coldStorage[l].toArchive);
            }
        }
        function fixFormat(toArchive) {

            // log.log("archive data");
            if (!toArchive || toArchive.length === 0) {
                return [];
            }

            var ret = [];

            for (var m = 0; m < toArchive.length; m++) {

                if (m === 0) {
                    ret.push({ id: toArchive[m].id, data: [ toArchive[m].point]});
                } else {
                    var found = -1;
                    for (var n = 0; n < ret.length; n++) {
                        if (ret[n].id == toArchive[m].id) {
                            ret[n].data.push(toArchive[m].point);
                            found = n;
                        }
                    }
                    if (found === -1) {
                        ret.push({ server: toArchive[m].server, id: toArchive[m].id, data: [ toArchive[m].point]});
                    }
                }
            }
            return ret;
        }

        // Get the stuff from the saved files and merge them.
        async.eachSeries(coldStorage,
                         function(file, next) {
                             if (file.data == [] || file.data.length == 0) {
                                 next();
                                 return;
                             }
                             if (fs.existsSync(file.file)) {
                                 fs.readFile(file.file, { encoding: 'utf8' }, function (err, someData) {

                                     if (err) {
                                         log.warn("Error reading %s archive file", file.file);
                                         log.error(err);
                                         next();
                                         return;

                                     } else {
                                         try {
                                             var newData = JSON.parse(someData);
                                             log.log("Loaded and parsed %s",file.file);
                                             combineData(file, newData);

                                         } catch (e) {
                                             log.warn("Error parsing settings.json loading default settings");
                                             log.error(e);
                                             next();
                                             return;
                                         }
                                     }

                                 });
                             } else {
                                 writeOutFile(file);
                             }

                             function combineData(aFile, newData) {

                                 for (var p = 0; p < newData.length; p++) {

                                     var found = -1;
                                     for (var q = 0; q < aFile.data.length; q++) {
                                         if (newData[p].server.toLowerCase() == aFile.data[q].server.toLowerCase()) {

                                             for (var r = 0; r < newData[p].data.length; r++) {
                                                 aFile.data[q].data.unshift(newData[p].data[r]);
                                             }
                                             found = q;
                                         }
                                     }
                                     if (found === -1) {
                                         aFile.data.push(newData[p]);
                                     }
                                 }
                                 writeOutFile(aFile);
                             }

                             function writeOutFile(outFile) {
                                 fs.writeFileSync(outFile.file, JSON.stringify(outFile.data), { encoding: 'utf8' });
                                 log.log("%s Saved archived files into persistent files: %j", (new Date).toLocaleString(),outFile.file);
                                 next();
                             }

                         }, function (err) {

                nconf.save(); // save current archive
                global._lockArchive = false;

                if (needToCallBack === true) {
                    cb();
                    return;
                }
            });
    }

};

// This will never have to run on the new implementation.
function cleanUpArchive(callback) {

    log.log("Starting to cleanUpArchive please wait...");
    cleanUpTempArchive(true, callback);

    function cleanUpTempArchive(needToCallBack, cb) {

        // array of arrays for each day that we are keeping

        var today = new Date();
        today.setHours(0);
        today.setMinutes(0);
        today.setSeconds(0);
        today.setMilliseconds(0);

        var fromTodayInMS = today.getTime();
        var aDayInMS = 86400000;

        var archive = [];
        if (fs.existsSync(path.join(settings.dataDirectory, settings.archiveFile))) {
            fs.readFile(path.join(settings.dataDirectory, settings.archiveFile), { encoding: 'utf8' }, function(err, data) {
                try {
                    archive = JSON.parse(data);
                } catch (e) {
                    log.error("Couldn't parse archive file.  Removing data");
                }
            });
        }

        var coldStorage = [];

        global._lockArchive = true;

        for (var day = settings.tempArchiveLength; day < settings.archiveDays; day++)
        {
            var aDay = {
                name: '',
                file: '',
                startEPOCH: (fromTodayInMS - ((day + 1) * aDayInMS)), // oldest date
                endEPOCH: ((fromTodayInMS - 1) - (day * aDayInMS)), // newest date
                toArchive: [],
                data: []
            };

            var getMonthAndDay = new Date(aDay.startEPOCH);

            aDay.name = 'archive-' + (getMonthAndDay.getMonth() + 1) + getMonthAndDay.getDate() + '.json';
            aDay.file = path.join(settings.archiveFolder, aDay.name);
            coldStorage.push(aDay);

        }
        log.log("%s Storage: %j", (new Date).toLocaleString(), coldStorage);
        var toRemove = [];

        for (var i = 0; i < archive.length; i++)
        {
            log.log("Data: %j", archive[i]);

            for (var j = coldStorage.length - 1; j >= 0; j--)
            {
                var done = false;
                while (done === false) {

                    if (archive[i].data.length > 0 && archive[i].data[0]) // oldest data point
                    {

                        if (archive[i].data[0].time < coldStorage[j].startEPOCH) { // data is older than we keep

                            log.trace("Dropping old data from %s: %j",
                                      archive[i].id,
                                      archive[i].data.shift()
                            ); // drop data

                        } else if (archive[i].data[0].time <= coldStorage[j].endEPOCH) { // data needs to be long term archived

                            coldStorage[j].toArchive.push({  // place in coldstorage queue to be merged with current data
                                                              server: archive[i].id,
                                                              point:  archive[i].data.shift()
                                                          }
                            );

                        } else {
                            log.trace("Server: %d with oldest data point: %s is not older than %s",
                                      archive[i].id,
                                      (new Date(archive[i].data[0].time)).toLocaleString(),
                                      (new Date(coldStorage[j].endEPOCH)).toLocaleString()
                            );
                            done = true;
                        }

                    } else if (archive[i].data[0] === null) {

                        log.log("Dropping bad data");

                        archive[i].data.shift();

                    } else {
                        done = true;
                    }

                }
            }

            if (archive[i].data.length === 0) {
                toRemove.unshift(i); // Pushes onto the top of the stack
            }
        }
        for (var k = 0; k < toRemove.length; k++) // this will remove old shit
        {
            archive.splice(toRemove[k],1);
        }


        fs.writeFile(path.join(settings.dataDirectory, settings.archiveFile), JSON.stringify(archive), { encoding: 'utf8' }, function (err) {
            if (!err) {
                log.info("Successfully archived to files");
            } else {
                log.error(err);
            }
        });

        for (var l = coldStorage.length - 1; l >= 0; l--)
        {
            if (coldStorage[l].toArchive.length > 0) {
                coldStorage[l].data = fixFormat(coldStorage[l].toArchive);
            }
        }
        function fixFormat(toArchive) {

            // log.log("archive data");
            if (!toArchive || toArchive.length === 0) {
                return [];
            }

            var ret = [];

            for (var m = 0; m < toArchive.length; m++) {

                if (m === 0) {
                    ret.push({ id: toArchive[m].id, data: [ toArchive[m].point]});
                } else {
                    var found = -1;
                    for (var n = 0; n < ret.length; n++) {
                        if (ret[n].id == toArchive[m].id) {
                            ret[n].data.push(toArchive[m].point);
                            found = n;
                        }
                    }
                    if (found === -1) {
                        ret.push({ id: toArchive[m].id, data: [ toArchive[m].point]});
                    }
                }
            }
            return ret;
        }

        // Get the stuff from the saved files and merge them.
        async.eachSeries(coldStorage,
                         function(file, next) {
                             if (file.data == [] || file.data.length == 0) {
                                 next();
                                 return;
                             }
                             if (fs.existsSync(file.file)) {
                                 fs.readFile(file.file, { encoding: 'utf8' }, function (err, someData) {

                                     if (err) {
                                         log.warn("Error reading %s archive file", file.file);
                                         log.error(err);
                                         next();
                                         return;

                                     } else {
                                         try {
                                             var newData = JSON.parse(someData);
                                             log.log("Loaded and parsed %s",file.file);
                                             combineData(file, newData);

                                         } catch (e) {
                                             log.warn("Error parsing settings.json loading default settings");
                                             log.error(e);
                                             next();
                                             return;
                                         }
                                     }

                                 });
                             } else {
                                 writeOutFile(file);
                             }

                             function combineData(aFile, newData) {

                                 for (var p = 0; p < newData.length; p++) {

                                     var found = -1;
                                     for (var q = 0; q < aFile.data.length; q++) {
                                         if (newData[p].id == aFile.data[q].id) {

                                             for (var r = 0; r < newData[p].data.length; r++) {
                                                 aFile.data[q].data.unshift(newData[p].data[r]);
                                             }
                                             found = q;
                                         }
                                     }
                                     if (found === -1) {
                                         aFile.data.push(newData[p]);
                                     }
                                 }
                                 writeOutFile(aFile);
                             }

                             function writeOutFile(outFile) {
                                 fs.writeFileSync(outFile.file, JSON.stringify(outFile.data), { encoding: 'utf8' });
                                 log.log("%s Saved archived files into persistent files: %j", (new Date).toLocaleString(),outFile.file);
                                 next();
                             }

                         }, function (err) {

                global._lockArchive = false;

                if (needToCallBack === true) {
                    cb();
                    return;
                }
            });
    }

};

// Archive has been fixed at this point so .id will work.
function clearArchiveFromCurrent(toArchive) {

    var toPurge = [];

    for (var i = 0; i < toArchive.length; i++)
    {
        if (!toArchive[i].id) {
            toArchive[i].id = controller.getServerId({hostName: toArchive[i].server});
        }

        if (toArchive[i].id != null && toArchive[i].data && toArchive[i].data.length > 0) {

            toPurge.push({id: toArchive[i].id, time: toArchive[i].data[toArchive[i].data.length - 1].time || 0 });

        } else {
            log.warn("PURGE Error: Trying to build purge list skipped a value from toArchive %j", toArchive[i]);
        }
    }

    log.trace("Purge request sent %j", toPurge);
    _sock.emit('purge', toPurge);

};

// Combines toArchive into the standard schema.
// [{id: 0, data: [{ time: 0, cpu: 0, mem: 0}]]
// return sorted list
function combineNewServers(toArchive) {

    if (!toArchive || toArchive.length === 0) {
        log.warn("Tried to combine empty archive");
        return [];
    } else {

        var ret = [];

        for (var i = 0; i < toArchive.length; i++)
        {
            var found = -1;
            for (var j = 0; j < ret.length; j++) {

                if (ret[j].id == toArchive[i].id) {
                    log.trace("Combining data points to server " + ret[j].id);
                    ret[j].data.push(toArchive[i].point);
                    found = j;
                }
            }
            if (found === -1) {

                log.trace('Combining new server Archive: %j', toArchive[i]);
                ret.push(
                    {
                     id: toArchive[i].id,
                     data: [ toArchive[i].point ]
                    });
            }
        }
        return sortServersAndData(ret);
    }
};

function sortServersAndData(servers) {
    var ret = sortServerById(servers);
    return ret.map(function (aServer) {
       aServer.data = sortDataByTime(aServer.data);
        return aServer;
    });
}

function sortServerById(servers) {
    var servers = servers || [];
    return servers.sort(function (a, b) {
        return a.id - b.id;
    });
};

function sortDataByTime(data) {
    var data = data || [];
    return data.sort(function (a, b) {
        return a.time - b.time;
    });
};

// socket.on(newData);
function handleData(sock) {

    sock.on('newData', dataHandler);

};

// Legacy does not need to manipulate current because current is held within
function dataHandler(serverId, values) {

    log.trace("New data from server(%d) with %j", serverId, values);

};

/**
 *
 * Timers:
 *  clean current data that is not archived
 *  keep DB file in sync with controller
 *
 */

function startTimers() {

    setInterval(cleanUpData2, legacySettings.currentCleanupFrequency);
    setInterval(handleDBSyncInterval, legacySettings.throttleDB * 2);

};

function cleanUpData2() {


    var servers = controller.current();
    var toArchive = [];

    for(var i = 0; i < servers.length; i++)
    {
        var temp = servers[i].data;
        var done = false;

        while (done !== true)
        {
            if (temp.length > 1) // keep the latest
            {
                if (temp[0].time <= (new Date().getTime() - legacySettings.currentLength))
                {
                    var newArch = {
                        id: servers[i].id,
                        point: servers[i].data.shift()
                    };
                    log.trace("Sending to archive: %j", newArch);
                    toArchive.push(newArch);

                } else {
                    done = true;
                }

            } else {
                done = true;
            }
        }
    }
    /*
        toArchive = [ { id: 1, point: { data }}, { id: 1, pint: { data1 }} ]
     */
    log.trace("toArchive %j", toArchive);

    if (toArchive.length > 0) {

        log.log("Archiving %d objects", toArchive.length);
        log.trace("Archiving: %j", toArchive);

        archiveData2(toArchive);

    }
    var dataFile = path.join(settings.dataDirectory, settings.dataFile);
    writeOutJSON(dataFile, servers, 1, function writeOutJSONCallback(success) {
        if (success === true) {
            log.log("Wrote out current file %s", dataFile);
            log.trace("File: %s = %j", dataFile, servers);
        } else {
            log.warn("Failed to writeout %s", dataFile);
        }
    });

};

function archiveData2(toArchive) {

    log.trace('toArchive %j', toArchive);

    if (toArchive && toArchive.length > 0) {

        // returns an array of toArchives split by days
        var splitArchives = sortPointsAndSplit(toArchive);

        log.trace('sortedPoints %j', splitArchives);

        async.eachSeries(splitArchives, handleMergingArchive, function archiveData2Callback(err) {
            if (err) {
                log.error("Error handling archive", err);
            } else {
                log.trace("Successfully merged archive");
            }
        });
    }
};

function handleMergingArchive(toMerge, next) {

    log.trace("toMerge: %j", toMerge);

    if (toMerge && toMerge.length && toMerge.length > 0 && toMerge[0].data && toMerge[0].data.length > 0) {

        var outFile = path.join(settings.dataDirectory, getArchiveFileName(toMerge[0].data[0].time || new Date().getTime()));

        readInJSON(outFile, function (data) {

            if (!(data && data.length)) {
                data = [];
            }
            log.trace("read in Archive: %j", data);

            var archive = mergeServers(toMerge, data);

            log.trace("writing out to Archive: %j", archive);

            writeOutJSON(outFile, archive, 3, function (success) {
                if (success == true) {
                    clearArchiveFromCurrent(toMerge);
                    next();
                } else {
                    log.error("Could not write out archive data to %s", outFile);
                    next();
                }
            });

        });

    } else {
        next();
    }
};

function writeOutJSON(fileName, data, tries, callback) {

    if (data && tries > 0) {

        var dataOut = JSON.stringify(data);

        fs.writeFile(fileName, dataOut, { encoding: 'utf8'}, function (err) {

            if (err) {

                log.warn("Failed to write file to disk %s", fileName);
                log.error(err);
                tries--;

                setTimeout( function () { writeOutJSON(fileName, data, tries, callback); }, 200);

            } else {

                callback(true);

            }

        });
    } else {
        if (tries == 0) {
            log.warn("Error writing JSON file out to %s", fileName);
        }
        callback(false);
    }


};

function mergeServers(serversA, serversB) {

    var ret = [];
    if (serversA && serversA.length && serversB && serversB.length) {

        return sortedMergeServers(sortServerById(serversA), sortServerById(serversB));

    } else if (serversA && serversA.length) {
        ret = serversA;
    } else if (serversB && serversB.length) {
        ret = serversB;
    } else {
        log.warn("Sent two empty files?");
        log.warn("A: %j", serversA);
        log.warn("B: %j", serversB);
        return ret;
    }
    return sortServerById(ret);
};

function sortedMergeServers(serversA, serversB) {

    var ret = [];
    var i = 0, j = 0;

    var serversA = serversA || [];
    var serversB = serversB || [];

    log.trace("A: %j B: %j", serversA, serversB);



    while (i < serversA.length && j < serversB.length)
    {

        if (serversA[i].id < serversB[j].id) {

            ret.push(serversA[i]);
            i++;

        } else if (serversA[i].id > serversB[j].id) {

            ret.push(serversB[j]);
            j++;

        } else {

            serversA[i].data = sortedMergeData(sortDataByTime(serversA[i].data), sortDataByTime(serversB[j].data));

            ret.push(serversA[i]);
            i++;
            j++;
        }
    }

    while (i < serversA.length) {
        ret.push(serversA[i]);
        i++;
    }

    while (j < serversB.length) {
        ret.push(serversB[j]);
        j++;
    }

    return ret;
};

function sortedMergeData(dataA, dataB) {

    var ret = [];
    var i = 0, j = 0;

    var dataA = dataA || [];
    var dataB = dataB || [];

    log.trace("DataMerge: A: %j B: %j", dataA, dataB);

    while (i < dataA.length && j < dataB.length)
    {

        if (dataA[i].time < dataB[j].time) {

            ret.push(dataA[i]);
            i++;

        } else if (dataA[i].time > dataB[j].time) {

            ret.push(dataB[j]);
            j++;

        } else {

            ret.push(dataA[i]);
            ret.push(dataB[j]);
            i++;
            j++;
        }
    }

    while (i < dataA.length) {
        ret.push(dataA[i]);
        i++;
    }

    while (j < dataB.length) {
        ret.push(dataB[j]);
        j++;
    }

    return ret;
};

function readInJSON(fileName, cb) {

    fs.exists(fileName, function (exists) {

        if (exists) {

            fs.readFile(fileName, { encoding: 'utf8' }, function(err, data) {

                var data1 = null;
                if (!err) {

                    try {
                        data1 = JSON.parse(data);

                    } catch(e) {
                        log.warn("Couldn't parse archive file.  Removing data");

                    }
                } else {
                    log.error("Couldn't read archive file.");
                    log.error(err);

                }
                cb(data1);

            });

        } else {

            cb(null);
        }
    });
};

// toArchive = [ { id: 1, point: { data }}, { id: 1, pint: { data1 }} ]
function sortPointsAndSplit(toArchive) {

    var ret = [[]],
        oldestDate,
        newestDate;


    if (toArchive.length && toArchive.length > 0) {

        // Sorted By Time
        var toArchive = toArchive.sort(function (a, b) {
            return a.point.time - b.point.time;
        });

        try {

            oldestDate = toArchive[0].point.time;
            newestDate = toArchive[toArchive.length - 1].point.time;

        } catch (e) {
            log.error("Invalid point or times %j", toArchive);
            return ret;
        }

        if (comparePointDates(oldestDate, newestDate)) {
            return mergePoints([toArchive]);
        } else {

            var currentNum = 0;

            ret[currentNum].push([toArchive[i]]);
            for (var i = 1; i < toArchive.length; i++) {

                if (comparePointDates(oldestDate, toArchive[i].point.time) === false) {

                    // create new array in ret
                    ret.push([ toArchive[i]]);
                    oldestDate = toArchive[i].point.time;
                    currentNum++;

                } else { // Same day, add to existing archive
                    ret[currentNum].push(toArchive[i]);
                }
            }
            return mergePoints(ret);
        }

    } else {

        return ret;
    }

};

function comparePointDates(a, b) {

    var aDate = new Date(a);
    var bDate = new Date(b);

    return (aDate.getDate() == bDate.getDate() && aDate.getMonth() == bDate.getMonth());

};

function mergePoints(multiArray) {

    return multiArray.map(combineNewServers);

}


function getArchiveFileName(aDate) {


    var theDate = new Date();

    if (typeof aDate.getMonth === 'function') {

        theDate = aDate;

    } else if (typeof aDate === 'number' && aDate >= 0) {
        theDate = new Date(aDate);
    }

    var month = theDate.getMonth() + 1;
    var day = theDate.getDate();

    if (month < 10) {
        month = '-0' + month;
    } else {
        month = '-' + month + '';
    }
    if (day < 10) {

        return 'archive' + month + '0' + day + '.json';
    } else {

        return 'archive' + month + day + '.json';
    }
};


/**
 *
 *   DataHandler
 *
 */

var getData = exports.getData = function getData(options, currentData, callback) {

    var finalData = currentData || [];
    var servers = options.servers;

    var options2 = {
        start: options.startTime,
        end: options.endTime,
        servers: servers.filter(function (completed) {
          for (var i = 0; options.completed && i < options.completed.length; i++) {
              if (completed.id == options.completed[i]) {
                  return false;
              }
          }
          return true;
        })
    };
    log.trace("Options2: %j", options2);
    log.trace("Current: %j", currentData);

    var jobs = generateDataJobs(options2);

    async.mapSeries(jobs, handleDataJob, function (newData) {

        finalizeDataJobs(options, finalData, newData, function (finalData) {

            var ret = {
                servers: options.servers,
                groups: options.groups,
                dataTypes: options.dataTypes,
                data: finalData
            };

            callback(null, ret);

        });

    });
};

function generateDataJobs(options2) {

    var ret = [];
    var rangeFiles = getRangeAndSplitFiles(options2.start, options2.end);

    for (var i = 0;  i < rangeFiles.length; i++) {

        var aJob = {
            file: rangeFiles[i].file,
            start: options2.start,
            end: options2.end,
            servers: options2.servers
        };

        ret.push(aJob);
    }
    return ret;
}

function getRangeAndSplitFiles(startTime, endTime) {

    var aTime = startTime;
    var eTime = endTime || (new Date().getTime());
    var ret = [{ file: getArchiveFileName(aTime)}];

    while (!comparePointDates(aTime, eTime) && aTime < eTime) {

        ret.push({ file: getArchiveFileName(aTime)});

        aTime = aTime + 86400000;

    };

    log.debug("Ranged Files: %j", ret);
    return ret;
}

function handleDataJob (job, next) {

    log.trace("Job: %j", job);

    readInJSON(job.file, function (data) {

        if (data && data.length > 0) {

           var ret = data.filter(function (dataServer) {

                for (var i = 0; i < job.servers.length;i++) {
                    if (job.servers[i].id == dataServer.id) {
                        return true;
                    }
                }
                return false;

            });

            next(null, ret || []);

        } else {
            next(null, null);
        }
    });
}


function finalizeDataJobs(options, currentData, archivedData, cb) {

    if (!options) {
        log.error("No options sent");
    }
    var start = options.startTime;
    var end = options.endTime;
    var dataTypes = getFieldsFromDataTypes(options.dataTypes);

    var combinedData = [];
    var archivedData = archivedData || [];

    log.trace("currentData: %d", currentData.length);
    log.debug("archivedData: %j", archivedData);

    while (archivedData.length > 0) {
        combinedData = sortedMergeServers(combinedData, sortServerById(archivedData.shift()));
        log.trace("combinedData: %j", currentData);
    }

    var out = sortedMergeServers(filterDataByTimeAndDataTypes(start, end, dataTypes, combinedData).data, sortServerById(currentData));
    log.trace("Out: %j", out);
    cb(out);

}

function filterDataByTimeAndDataTypes(start, end, dataTypes, input) {


    log.trace("input: %j", input);
    log.trace("start: %d  end: %d", start, end);

    var start = start;
    var end = end;

    var input = input || [];
    var ret = {
        needMore: false,
        completedServerIds: [],
        data: []
    };

    for (var i = 0; i < input.length; i++) {

        var temp = constrainAndFilterData(sortDataByTime(input[i].data, start, end, dataTypes));

        if (temp.first > 0 || temp.first == input[i].data.length) {

            ret.completedServerIds.push(input[i].id);

        } else {
            ret.needMore = true;
        }

        ret.data.push({
                          id: input[i].id,
                          data: temp.newData
                      });
    }
    return ret;
}

function getFieldsFromDataTypes(dataTypes) {
    return dataTypes.map(function (dataType) {
        return dataType.field;
    });
}

function constrainAndFilterData(timedData, start, end, dataTypes) {


    log.trace("timedData: %j", timedData);

    var first = findFirst(timedData, start);
    var last = findLast(timedData, first, end);
    var newData = cleanDataTypes(timedData.slice(first, last), dataTypes);


    return {
        first: first,
        last: last,
        newData: newData
    };

};

function cleanDataTypes(timedData, dataTypes) {

    return timedData.map(
        function (dataPoint) {

            var newPoint = {
                time: dataPoint.time
            };
            for (var i = 0; i < dataTypes.length; i++) {
                if (dataPoint[dataTypes[i]]) {
                    newPoint[dataTypes[i]] = dataPoint[dataTypes[i]];
                }
            }
            return newPoint;
        });
}

function findFirst(timedData, start) {

    for (var i = 0; i < timedData.length && timedData[i].time < start;i++) {};
    return i;
}

function findLast(timedData, startAt, stop) {
    for (var i = startAt; i < timedData.length && timedData[i].time < stop;i++) {};
    return i;
}



exports.newServer = function newServer(server, cb) {

  var servers = controller.db().servers;
  var id = servers[servers.length - 1].id + 1;
  var server = server;
  server.id = id;
  cb(null, server);
  log.info("Added new server to db (%j)", server);
  __dbSyncNeeded = true;
};



/*

 changes = {

 servers:    [],
 groups:     [],
 dashboards: [],
 fronts:     [],
 dataTypes:  []

 };

 */


/*
 handleLoadDB(function (data) {

 if (data) {

 var db = data;

 var tables = Object.keys(changes);


 switch (tables)
 {

 case 'servers':
 {
 mergeServerChanges(changes.servers);
 break;
 }
 case 'groups':
 {
 break;
 }
 case 'dashboards':
 {
 break;
 }
 case 'fronts':
 {
 break;
 }
 case 'dataTypes':
 {
 break;
 }
 }
 } else {

 callback('noData');

 }



 for (var i = 0; i < tables.length; i++) {




 if (util.isArray(db[tables[i]])) {

 var table = changes[tables[i]];

 for (var k = 0; k < table.length; k++)
 {
 var found = -1;
 for (var j = 0; j < db[tables[i]].length; j++)
 {

 if (db[tables[i]][j].id == table[k].id) {

 var keys = Object.keys(table[k]);

 for (var m = 0; m < keys.length; m++) {
 db[tables[i]][j][keys[m]] = table[k][keys[m]];
 }
 found = 0;

 }
 }
 // Add new to the array
 if (found == -1) {
 db[tables[i]].push(table[k]);
 }
 }


 } else {
 log.warn("Unknown data found in db");
 }
 }

 handleSaveDB(db, true, function (err, db) {
 __DB_LOCK = false;
 callback(err, db);
 });

 });
 */
