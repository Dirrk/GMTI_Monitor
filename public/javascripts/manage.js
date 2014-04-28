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


       $scope.serverTasks = [
           { name: "Select all"},
           { name: "Deselect all"}
       ];

       $scope.taskSelected = $scope.serverTasks[0];

       $http.get('/groups', {cache: false}).success(function(data) {
           $scope.groups = data;
       });
       $http.get('/servers', {cache: false}).success(function(data) {

           $scope.servers = cleanData(data);

       });
       $http.get('/dashboards', {cache: false}).success(function(data) {
           $scope.dashboards = data;
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

           $http.json('/servers/create', { servers: serverList, group: groupId }).success(function(data) {
                if (data && data.length && data.length > 0)
                {
                    $scope.servers.concat(cleanData(data));
                }
                console.log("Success");
           }).error(function(data) {
               console.log("Error");
           });

       };
       function cleanData(data) {
           for(var i = 0; i < data.length; i++)
           {
               data[i].lastUpdate = new Date(data[i].lastUpdate).toLocaleString();
           }
           return data;
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