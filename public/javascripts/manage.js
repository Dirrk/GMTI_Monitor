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
       $scope.sortServers = 'group';
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

                   for (var k = 0; k < $scope.dashboards[i].groups.length; k++)
                   {

                       if ($scope.dashboards[i].groups[k] == $scope.groups[j].id) {

                           $("#Dash-" + i + "-selectedGroup-" + j).prop('checked', true);
                           k = $scope.dashboards[i].groups.length;
                           console.log("#Dash-" + i + "-selectedGroup-" + j);

                       } else {
                           console.log("Dashboards: " + i + " group " + k + " does not match " + $scope.groups[j].id);
                       }
                   }
               }
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
}


