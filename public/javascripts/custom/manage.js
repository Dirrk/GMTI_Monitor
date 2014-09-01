/**
 * Created by Derek Rada on 8/16/2014.
 */

var ServerPage = {

    numResults: 0,
    curPage: 1,
    curIndex: 0,
    numPages: function () {
        return Math.ceil(this.numResults / 10);
    }
};

var GroupPage = {
    groups: []
};


// Active the main tabs
$('#mainTabs a').click(function (e) {
    e.preventDefault();
    $(this).tab('show');
});

// var manageApp = angular.module('manageApp', ['ui.bootstrap']);

var serverHandleBar;

$(document).ready(function () {

    console.log("test");

    serverHandleBar = Handlebars.compile($("#serverRows").text());
    loadServerTab(0);

});


function loadServerTab(lastIndex) {

    var lastIndex = lastIndex || ServerPage.curIndex || 0;

    $.get("/api/servers").done(
        function (data) {
            ServerPage.curIndex = lastIndex;
            if (data && data.servers && data.servers.length) {

                if (data.total) {
                    ServerPage.numResults = data.total;
                } else {
                    ServerPage.numResults = data.servers.length;
                }

                serverViewLoad(data.servers);
            }
        });
}


function serverViewLoad(servers) {


    $("#serverBody").empty();
    var textGroups = [];
    getGroups(function (groups) {

        for (var i = 0; i < groups.length; i++) {
            $("#server-groups-new").append("<option>" + groups[i].name + "</option>");
            textGroups.push(groups[i].name);
        }
        $('.selectpicker').selectpicker();

        servers.forEach(function (server) {

            server._groups = server.groups || [];
            server.groups = textGroups;
            $("#serverBody").append(serverHandleBar(server));
            $('.selectpicker').selectpicker();

            var tempGroups = [];

            for (var i = 0; i < server._groups.length; i++) {

                for (var j = 0; j < groups.length; j++) {
                    if (groups[j].id == server._groups[i]) {
                        // console.log("Server: " + server.name + " is in group " + groups[j].name);
                        tempGroups.push(groups[j].name);
                    }
                }
            }
            $("#server-groups-" + server.id).selectpicker('val', tempGroups);
        });
    });

    console.log("Number of pages " + ServerPage.numPages());
}

function getGroups(cb) {

    $.get("/api/groups").done(function (data) {

        if (data.groups) {
            GroupPage.groups = data.groups;
        }

        cb(data.groups);

    });
}

// setTimeout(testCode, 1000);

function serverSave(id) {

    console.log("Saved server: " + id);
    var desc = $("#server-desc-" + id).val();
    var textGroups = $("#server-groups-" + id).val() || [];
    var groups = convertGroupsToId(textGroups);
    var ip = $("#server-ip-" + id).val();

    var payload = {
        desc: desc,
        ip: ip,
        groups: groups
    };



    $.ajax({
        type: "PUT",
        url: "/api/server/" + id,
        data: payload,
        success: function () {
            console.log("Saved successfully");
        }

    });

}

function convertGroupsToId(textGroups) {

    var ret = [];
    for (var i = 0; i < textGroups.length; i++) {

        for (var j = 0; j < GroupPage.groups.length; j++) {
            if (GroupPage.groups[j].name == textGroups[i]) {
                ret.push(GroupPage.groups[j].id * 1);
            }
        }
    }
    return ret;
}

function serverDelete(id) {
    console.log("Deleted server: " + id);

    $.ajax({
               type: "DELETE",
               url: "/api/server/" + id,
               success: function () {
                   $("#server-row-" + id).remove();
                   console.log("Deleted successfully");
               }
    });

}


function testCode() {

    var serverRowTemplate = Handlebars.compile($("#serverRows").text());
    var newRow = serverRowTemplate({

        id: 1,
        hostName: "moc-lx0000123",
        desc: "What !!",
        groups: ["Test", "test2"],
        ip: "10.1.4.3"
                      });
    $("#serverBody").append(newRow);
    console.log(newRow);
    $('.selectpicker').selectpicker();
    return;

    $("#serverBody").append("<tr> " +
                                "<td>1</td> " +
                                "<td>moc-lx0001</td> " +
                                "<td>none</td> " +
                                "<td><select class=\"selectpicker\" multiple data-selected-text-format=\"count>2\"><option>Mustard</option><option>Ketchup</option></select></td> " +
                                "<td>192.168.1.20</td> " +
                                "<td></td> " +
                             "</tr>");
    $('.selectpicker').selectpicker();

}