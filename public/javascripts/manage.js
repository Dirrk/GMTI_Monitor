/**
 * Created by Derek Rada on 4/27/2014.
 */


var manageApp = angular.module('manageApp', ['ui.bootstrap']);

manageApp.controller('manageCntrl', ['$scope', '$http',

   function($scope, $http) {


       $scope.navType = 'pills';
       $scope.servers = [];
       $scope.groups = [];
       $scope.dashboards = [];
       $scope.searchText = '';
       $scope.serverCreateName = undefined;
       $scope.serverEditGroup = undefined;
       $scope.createGroup = undefined;
       $scope.sortServers = 'id';
       $scope.reverse = false;

       $scope.allDataReady = 0;


       $scope.serverTasks = [
           { name: "Select all", task: function () { selectAll(true) } },
           { name: "Deselect all", task: function () { selectAll(false) }},
           { name: "Save selected", task: function () { saveSelected() }},
           { name: "Delete selected", task: function () { delSelected() }},
           { name: "Select unassigned servers", task: function ()  { selectNew() }},
           { name: "Assign group to selected", task: function () { editSelected() }}
       ];

       $scope.taskSelected = $scope.serverTasks[0];

       /**


       $http.get('/groups', {cache: false}).success(function(data) {
           $scope.groups = data;
           $scope.allDataReady++;
       });
       getServers();
       function getServers() {
           $http.get('/servers', {cache: false}).success(function (data) {
               $scope.servers = cleanData(data);
               $scope.allDataReady++;
            }
           );
       }
       $http.get('/dashboards', {cache: false}).success(function(data) {
           $scope.dashboards = data;
           $scope.allDataReady++;
       });

       */
       $scope.addServer = function () {
           var text = $("#serverSearch").val();
           showModal("#serverModal");
           $scope.serverCreateName = text;
           $scope.serverCreateGroup = $scope.groups[0] || $scope.serverCreateGroup;
       };

       $scope.createServer = function () {
            console.log($scope.serverCreateName);

           var serverList = $scope.serverCreateName.split('\n');
           var groupId = $scope.serverCreateGroup;


           $http.post('/servers/create', { servers: serverList, group: groupId.id }).success(function(data) {
                if (data && data.length && data.length > 0)
                {
                    $scope.servers = $scope.servers.concat(cleanData(data));
                }
                console.log("Success");
           }).error(function(data) {
               console.log("Error");
           });

       };

       $scope.saveServer = function(id) {

           var sid = getServerIdByName(id);

           if (sid >= 0 && sid < $scope.servers.length)
           {
               var server = $scope.servers[sid];

               if (isNaN(server.group) === true || typeof server.group == typeof {}) {
                   server.group = server.group.id;
               }
               var data = [server];

               console.log("ID: " + sid);
               console.log("Server:" + JSON.stringify($scope.servers[sid]));

               performServerAction('UPDATE', data);
           }



       };
       $scope.delServer = function(id) {

           var sid = getServerIdByName(id);

           if (sid >= 0 && sid < $scope.servers.length) {

               var server = $scope.servers[sid];

               var data = [server];

               console.log("ID: " + sid);
               console.log("Server:" + JSON.stringify($scope.servers[sid]));

               performServerAction('DELETE', data, function () {
                   console.log("Deleted server");
                   $scope.servers.splice(sid, 1);
               }
               );
           }

       };
       $scope.runTask = function () {
           $scope.taskSelected.task();
       };


       $scope.addGroup = function() {

           var text = $scope.createGroup;
           if (text.length > 0)
           {
               $http.post('/manage/group', { command: 'CREATE', group: { id: -1, name: text } }).success(function (data) {
                   if (data && data.id != undefined)
                   {
                       console.log(data);
                        $scope.groups.push(data);
                   } else {
                       console.log(data);
                   }
               });
           }

       };

       $scope.delGroup = function(id) {

           if (id >= 0)
           {
               $http.post('/manage/group', { command: 'DELETE', group: { id: $scope.groups[id].id } }).success(function (data) {
                    $scope.groups.splice(id, 1);
               });
           }

       };
       $scope.saveGroup = function(id) {

           if (id >= 0)
           {
               $http.post('/manage/group', { command: 'UPDATE', group: { id: $scope.groups[id].id, name: $scope.groups[id].name } }).success(function (data) {
                   console.log("Group saved");
               });
           }

       };
       function getServerIdByName(name) {
           for (var i = 0; i< $scope.servers.length; i++) {
               if (name == $scope.servers[i].server) {
                   console.log("Found: " + name + " at " + i);
                   return i;
               }
           }
           console.log("Couldn't find " + name);
           return -1;
       }

       function cleanData(data) {
           for(var i = 0; i < data.length; i++)
           {

               data[i].lastUpdate = new Date(data[i].lastUpdate).toLocaleString();
               data[i].selected = false;

           }
           return data;
       }
       function performServerAction(type, data, callback)
       {
           $http.post('/manage/server', { command: type, servers: data }).success(function (data) {

               if (typeof callback === 'function') {
                   callback(null, data);
               } else {
                   console.log("success");
               }

           }).error(function (data) {
               if (typeof callback === 'function') {
                   callback(data);
               } else {
                   console.log("success");
               }
           });
       }

       function selectAll(bool) {
            console.log("selectAll");
           for (var i = 0; i < $scope.servers.length; i++)
           {
               $scope.servers[i].selected = bool;
           }
       }

       function saveSelected() {
           var servers = $scope.servers;
           var data = [];
           for (var i = 0; i < servers.length; i++)
           {
               if (servers[i].selected === true)
               {
                   if (isNaN(servers[i].group) === true || typeof servers[i].group == typeof {}) {
                       servers[i].group = servers[i].group.id;
                   }
                   data.push(servers[i]);
               }
           }
           console.log("saveSelected: ");
           console.log(data);
           performServerAction('UPDATE', data, function () {
               selectAll(false);
           });
       }

       function delSelected() {
           var servers = $scope.servers;
           var data = [];
           for (var i = 0; i < servers.length; i++)
           {
               if (servers[i].selected === true)
               {
                   data.push(servers[i]);
               }
           }
           console.log("delSelected: ");
           console.log(data);
           performServerAction('DELETE', data, function() {
               getServers();
           });
       }

       function editSelected() {
           showModal("#serverMassGroupChange");

           console.log("show");

       }
       function selectNew() {
           for (var i = 0; i < $scope.servers.length; i++)
           {
               if (isNaN($scope.servers[i].group) === false && $scope.servers[i].group < 0)
               {
                   $scope.servers[i].selected = true;
               }
           }
       }
       function checkData() {
           if ($scope.allDataReady > 2)
           {
               fixDashboards();

           } else {
               setTimeout(function () { checkData(); }, 500);
           }
       }
       checkData();
       function fixDashboards() {

           console.log("Fix dashboards");

           // Dash-{{$parent.$index}}-selectedGroup-{{$index}}

           for (var i = 0; i < $scope.dashboards.length; i++)
           {

               for (var j = 0; j < $scope.groups.length; j++)
               {

                   for (var k = 0; k < $scope.dashboards[i].legacyGroups.length; k++)
                   {

                       if ($scope.dashboards[i].legacyGroups[k] == $scope.groups[j].id) {

                           $("#Dash-" + i + "-selectedGroup-" + j).prop('checked', true);
                           k = $scope.dashboards[i].legacyGroups.length;
                           console.log("#Dash-" + i + "-selectedGroup-" + j);

                       } else {
                           console.log("Dashboards: " + i + " group " + k + " does not match " + $scope.groups[j].id);
                       }
                   }
               }
           }

           $scope.$apply();

       };

       function syncDB(force, cb, tries) {

           var dbVersion = localStorage.getItem("dbVersion");

           if (force === true || dbVersion === null) {
               dbVersion = 0;
           }

           var tries = tries || 0;

           if (tries > 10) {
               console.log("SyncDB did not succeed");
               return;
           }

           $.get("/api/db/" + dbVersion)

               .done( function (dbData) {

                          if (dbData && dbData.version) {

                              if (dbData.version == dbVersion) {
                                  console.log("db has the correct version already");
                                  getValuesFromStorage(cb);
                              } else if (dbData.db) {

                                  // should I clear this ?
                                  localStorage.clear();
                                  localStorage.setItem("dbVersion", dbData.version);
                                  placeValuesInStorage(dbData.db);

                                  if (cb && typeof cb === 'function') {
                                      cb();
                                  }

                              } else {
                                  console.log("ERROR :: This wasn't expected, check the url");
                                  console.log(JSON.stringify(dbData));
                                  setTimeout(function () {
                                      syncDB(force, cb, tries + 1);
                                  }, (tries * 2000));
                              }

                          } else {
                              console.log("ERROR :: Data is not in correct format");
                              setTimeout(function () {
                                  syncDB(force, cb, tries + 1);
                              }, (tries * 2000));
                          }
                      })
               .fail( function () {
                          console.log("Did not download database try number: " + tries);
                          setTimeout(function () {
                              syncDB(force, cb, tries + 1);
                          }, (tries * 2000));
                      })
           ;
           $scope.allDataReady = 3;

       };

       syncDB(false, fixDashboards);

       /**
        *  $scope.servers = [];
        *  $scope.groups = [];
        *  $scope.dashboards = [];
        *
        **/


       function placeValuesInStorage(data) {

           var dbServerPrefix = 'db:server:',
               dbGroupPrefix = 'db:group:',
               dbDashPrefix = 'db:dashboard:',
               dbFrontsPrefix = 'db:front:',
               dbDataTypesPrefix = 'db:dataTypes:';

           $scope.servers = data.servers;
           $scope.groups = data.groups;
           $scope.dashboards = data.dashboards;

           for (var i = 0; data.servers && data.servers.length && i < data.servers.length; i++) {
               localStorage.setItem(dbServerPrefix + data.servers[i].id, JSON.stringify(data.servers[i]));
           }

           for (var i = 0; data.groups && data.groups.length && i < data.groups.length; i++) {
               localStorage.setItem(dbGroupPrefix + data.groups[i].id, JSON.stringify(data.groups[i]));
           }

           for (var i = 0; data.dashboards && data.dashboards.length && i < data.dashboards.length; i++) {
               localStorage.setItem(dbDashPrefix + data.dashboards[i].id, JSON.stringify(data.dashboards[i]));
           }

           for (var i = 0; data.fronts && data.fronts.length && i < data.fronts.length; i++) {
               localStorage.setItem(dbFrontsPrefix + data.fronts[i].id, JSON.stringify(data.fronts[i]));
           }

           for (var i = 0; data.dataTypes && data.dataTypes.length && i < data.dataTypes.length; i++) {
               localStorage.setItem(dbDataTypesPrefix + data.dataTypes[i].id, JSON.stringify(data.dataTypes[i]));
           }



       };

       function getValuesFromStorage(cb) {

           for ( var i = 0, len = localStorage.length; i < len; ++i ) {

               if (localStorage.key(i).indexOf('db:server:') >= 0) {
                   console.log(localStorage.key(i));
                   $scope.servers.push(JSON.parse(localStorage.getItem(localStorage.key(i))));

               } else if (localStorage.key(i).indexOf('db:group:') >= 0) {
                   console.log(localStorage.key(i));
                   $scope.groups.push(JSON.parse(localStorage.getItem(localStorage.key(i))));
               } else if (localStorage.key(i).indexOf('db:dashboard:') >= 0) {
                   console.log(localStorage.key(i));
                   $scope.dashboards.push(JSON.parse(localStorage.getItem(localStorage.key(i))));
               } else {
                   console.log("Missed: " + localStorage.key(i));
               }
           }

           console.log($scope.servers);
           console.log($scope.dashboards);
           console.log($scope.groups);
           if (cb && typeof cb === 'function') {
               cb();
           }

       };




       // DashCreate-selectedGroup-{{$index}}
       // .createDash()
       $scope.createDash = function () {

           var id = $scope.createDashID;
           var front = $scope.createDashFront;
           var name = $scope.createDashName;
           var desc = $scope.createDashDesc;
           var groups = [];
           for (var i = 0; i < $scope.groups.length; i++)
           {

               if ($("#DashCreate-selectedGroup-" + i).prop('checked') == true)
               {
                   groups.push($scope.groups[i].id);
               }
           }
           var command = "CREATE";

           var sendData = {

               id: id,
               front: front,
               name: name,
               description: desc,
               groups: groups
           };

           performDashAction(command, sendData, function (data) {

               $scope.dashboards.push(sendData);
               fixDashboards();

           });

       };

       $scope.saveDash = function (index) {

           var data = $scope.dashboards[index];
           
           var command = "UPDATE";

           data.groups = [];

           for (var i = 0; i < $scope.groups.length; i++)
           {

               if ($("#Dash-" + index + "-selectedGroup-" + i).prop('checked') == true)
               {
                   data.groups.push($scope.groups[i].id);
               }
           }


           performDashAction(command, data, function () {
               $scope.dashboards[index] = data;
               fixDashboards();
           });
       };

       $scope.delDash = function (index) {

           console.log($scope.dashboards[index]);
           var command = "DELETE";
           performDashAction(command, $scope.dashboards[index], function () {
               $scope.dashboards.splice(index, 1);
           });

       };


       function performDashAction(type, data, callback)
       {
           $http.post('/manage/dash', { command: type, dashboard: data }).success(function (data) {

               if (typeof callback === 'function') {
                   callback(null, data);
               } else {
                   console.log("success");
               }
               checkData();

           }).error(function (data) {
               if (typeof callback === 'function') {
                   callback(data);
               } else {
                   console.log("success");
               }
           });
       }


       $scope.serverEditMassGroup = function () {

           console.log($scope.serverEditGroup);

           var servers = $scope.servers;
           var data = [];
           var groupId = $scope.serverEditGroup.id;
           for (var i = 0; i < servers.length; i++) {

               if (servers[i].selected === true)
               {
                   var server = servers[i];
                   server.group = groupId;
                   data.push(server);
               }

           }
           console.log("editSelected: ");
           console.log(data);
           performServerAction('UPDATE', data, function () {
               selectAll(false);
               $("#serverMassGroupChange").hide();
               $("#serverMassGroupChange").css('opacity', 0);
           });

       };
       $("#serverMassGroupChange").hide();


   }]
);


function showModal(modalId) {
    if (!modalId) {
        var modalId = ".radamodal";
    }

    $(modalId).show();
    $(modalId).css('opacity', .98);

    $(".radamodalClose").click(function() {
        $(modalId).hide();
        $(modalId).css('opacity', 0);
    });
}

$(document.body).ready(function () {

    $("#notificationExit").click(function() {
        $("#notificationArea").hide();
    });

});

function showNotification(msg, level) {

    $("#notificationArea").removeClass('info fail pass warn');
    if (!level) {
        var level = 'info';
    }
    $("#notificationText").text(msg);
    $("#notificationArea").addClass(level);
    $("#notificationArea").show();
    setTimeout(function() {
        $("#notificationArea").hide();
    }, 3000);
};



