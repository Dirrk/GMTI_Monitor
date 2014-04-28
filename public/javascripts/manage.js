/**
 * Created by Derek Rada on 4/27/2014.
 */


var manageApp = angular.module('manageApp', ['ui.bootstrap']);

manageApp.controller('manageCntrl', ['$scope', '$http',
   function($scope, $http) {

       console.log("Inside scope");
       $scope.navType = 'pills';
       $scope.servers = [];
       $scope.groups = [];
       $scope.dashboards = [];
       $scope.searchText = '';
       $scope.serverCreateName = '';


       $scope.serverTasks = [
           { name: "Select all"},
           { name: "Deselect all"}
       ];

       $scope.taskSelected = $scope.serverTasks[0];

       $http.get('/groups', {cache: false}).success(function(data) {
           $scope.groups = data;
       });
       $http.get('/servers', {cache: false}).success(function(data) {
            for(var i = 0; i < data.length; i++)
            {
                data[i].lastUpdate = new Date(data[i].lastUpdate).toLocaleString();
            }
           $scope.servers = data;
       });
       $http.get('/dashboards', {cache: false}).success(function(data) {
           $scope.dashboards = data;
       });

       $scope.addServer = function () {
           var text = $("#serverSearch").val();
           showModal("#serverModal");
           $scope.serverCreateName = text || '';
           $scope.serverCreateGroup = $scope.groups[0] || $scope.serverCreateGroup;
       };

       $scope.createServer = function () {

           var serverList = $scope.serverCreateName;
           var groupId = $scope.serverCreateGroup;
           console.log(serverList);
           console.log(groupId.id);

       };


       function groupNameById(id) {
           for (var i = 0; i < $scope.groups.length;i++)
           {
               if ($scope.groups[i].id == id) {
                   return $scope.groups[i].name;
               }
           }
           return id;
       }

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