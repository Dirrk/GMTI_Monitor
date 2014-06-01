/**
 * Created by Derek Rada on 5/31/2014.
 */

$(document).ready(function () {

    $("#servers-chosen").chosen();
    $("#dataType-chosen").chosen();

    $("#startDate").datetimepicker();
    $("#endDate").datetimepicker();


});
$("#genButton").click(function() {

    var startDate = new Date($("#startDate").val()).getTime();
    var endDate = new Date($("#endDate").val()).getTime() || undefined;
    var servers = [];
    var selectedServers = $("#servers-chosen option:selected");
    for (var i = 0; i < selectedServers.length; i++) {
        servers.push(selectedServers[i].value);
    }
    var dataTypes = [];
    var selectedTypes = $("#dataType-chosen option:selected")
    for (var j = 0; j < selectedTypes.length; j++) {
        dataTypes.push(selectedTypes[j].text);
    }
    console.log("Date: " + startDate + " to " + endDate);
    console.log("Servers: "+ servers);
    console.log("DataTypes: "+ dataTypes);

    // $http.post('/manage/server', { command: type, servers: data })
    $.post("/report?json=1", {
        start: startDate,
        end: endDate || (new Date()).getTime(),
        servers: servers
    }).success(function(data) {

        console.log("Data: ");
        console.log(data);
        var fl = new FlotHelper();
        fl.loadMultiServerTimeGraph("#timechart", data.data, dataTypes);
        // #timechart

    });
});