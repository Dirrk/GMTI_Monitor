/**
 * Created by Derek Rada on 5/31/2014.
 */

$(document).ready(function () {

    $("#servers-chosen").chosen({search_contains: true});
    $("#dataType-chosen").chosen({search_contains: true});

    $("#startDate").datetimepicker();
    $("#endDate").datetimepicker();


});
$("#genButton").click(function() {

    try {

        $("#timeSelection").dateRangeSlider("destroy");
        $("#timeSelection").width($(".flot-base").width() - 50);

    } catch (err) {
        $("#timeSelection").width(Math.floor(($(document).width() *.95) - 50));
        console.log("Why make a global var when you can catch");
    }

    var startDate = new Date($("#startDate").val()).getTime();
    var endDate = new Date($("#endDate").val()).getTime() || new Date().getTime();
    var servers = [];
    var _data;
    var selectedServers = $("#servers-chosen option:selected");
    for (var i = 0; i < selectedServers.length; i++) {
        servers.push(selectedServers[i].value);
    }
    var dataTypes = [];
    var selectedTypes = $("#dataType-chosen option:selected");
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

        _data = legacyFix(data.data);
        var fl = new FlotHelper();

        fl.loadMultiServerTimeGraph("#timechart", _data, dataTypes, { start: startDate, end: endDate});
        // #timechart

        $("#timeSelection").dateRangeSlider(
            {
                bounds: {
                    min: new Date(startDate),
                    max: new Date(endDate)
                },
                step: {
                    minutes: 1
                },
                defaultValues:{
                    min: new Date(startDate),
                    max: new Date(endDate)
                },
                valueLabels: "change",
                arrows:false,
                formatter:  function(val){
                    var days = val.getDate(),
                        month = val.getMonth() + 1,
                        hour = val.getHours(),
                        minute = val.getMinutes();
                    return month + "/" + days + " - " + hour + ":" + minute;
                }
            }
        );

        $("#timeSelection").bind("userValuesChanged", function(e, vals){

            fl.loadMultiServerTimeGraph("#timechart", _data, dataTypes, { start: vals.values.min, end: vals.values.max});
        });
    });
});


function legacyFix(inData) {

    if (inData && inData.length) {

        var ret = inData.slice();

        for (var i = 0; i < ret.length; i++) {

            if (inData[i].id && localStorage.getItem("db:server:" + inData[i].id)) {

                ret[i].server = JSON.parse(localStorage.getItem("db:server:" + inData[i].id)).name;

            } else {

                i = ret.length; // stop parsing this shit
                syncDB();
                return [];
                ret[i].server = "unknown-" + inData[i].id || i;
                console.log("LegacyFix :: Added unknown server should I have downloaded this data instead?");

            }
            // console.log("LegacyFixed " + ret[i].server);
        }
        importCurrentData(inData);
        return ret;

    } else {
        return [];
    }
};

function importCurrentData(inData) {

    for(var i = 0; inData && inData.length && i < inData.length; i++) {

        if (inData[i].id) {
            sessionStorage.setItem("server:" + inData[i].id + ":data", JSON.stringify(inData[i].data || []));
        } else {
            console.log("Data did not contain an ID!!!!! inData[" + i+ "] = " + JSON.stringify(inData[i]));
        }
    }
};
