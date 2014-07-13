/**
 * Created by Derek Rada on 4/18/2014.
 */

$(document.body).ready(function() {

    var dashboardId = $("#hiddenField").data('did');
    console.log("Document Ready");
    safeHandler(dashboardId);

    $(".currentTime").text(new Date().toLocaleString());
});

// angular
var usageApp = angular.module('usageApp', []);

usageApp.controller('usageCntrl', ['$scope',
   function($scope) {

       $scope.CPUServers = [];
       $scope.MemServers = [];

       // external controllers ** Call .scope.$apply() **
       $scope.updateCPU = function (servers) {
           for (var i = 0; i < servers.length; i++)
           {
               var cpu = Math.floor(servers[i].cpu * 1000);
               servers[i].cpu = cpu / 1000;
           }
           $scope.CPUServers = servers;
       };
       $scope.updateMem = function (servers) {
           for (var i = 0; i < servers.length; i++)
           {
               var mem = Math.floor(servers[i].mem * 1000);
               servers[i].mem = mem / 1000;
           }
           $scope.MemServers = servers;
       };
       $scope.drillDown = function (server) {
           $.external_callLoadDrillDown(server);
       }
   }] );




function safeHandler(dataId) {

    "use strict";

    // global
    var currentDataPoints,
        currentGroups = [],
        previousPoint = null,
        previousPoint1 = null,
        dashboardDataUrl = '/api/data/',
        dashboardSettingsUrl = '/api/dashboard/',
        dashboardId = "dev_test";

    // static
    var CPU_COLOR = "#00B7FF",
        MEM_COLOR = "#FFB700";

    // functions

    if (dataId && dataId.length && dataId.length > 0)
    {
        dashboardId = dataId;
    }

    dashboardDataUrl = dashboardDataUrl + dashboardId;
    dashboardSettingsUrl = dashboardSettingsUrl + dashboardId;

    sessionStorage.setItem("dashboardUrl", dashboardDataUrl);
    sessionStorage.setItem("dashboardSettingsUrl", dashboardSettingsUrl);


    getFirstData(function (success) {

       if (success === true) {

           loadData(true);

       } else {
           console.log("Error loading data");
       }
    });

    /**
     *  Load data from JSON API
     *
     *  connect to API and get server data points
     *  loadThe UI Elements dynamically using flot
     *  call itself in 30 seconds
     *
     */

     // run at start
    // loadData(true);



    function loadData(firstRun) {

        return;

        console.log("Start: " + new Date().getTime());

        $.get(dashboardDataUrl).success( function( inData ) {

            console.log("performed loadData");
            console.log(inData);

            if (inData && inData.servers && inData.servers.length > 0) {

                console.log("inside load if of loadData");

                currentDataPoints = sortServers(inData.servers);

                currentGroups = inData.groups || [];

                console.log("Mid: " + new Date().getTime());

                loadBarUI(currentDataPoints);
                // loadGaugesUI(currentDataPoints);
                if (firstRun === true) {
                    loadGaugesUI2(currentDataPoints);
                }
                loadSortUI(currentDataPoints);
                loadGroupsAverageTimeGraph(currentDataPoints, currentGroups);
                $(".currentTime").text(new Date().toLocaleString());
                console.log("End: " + new Date().getTime());
            }
        });
        setTimeout(function() { loadData(); }, 15000);
    };

    /**
     * CPU/Memory Bar UI Controller
     *
     *
     * loads the bar graph onto the div element #cpubar
     * call flot with $.plot to dynamically render the bar graph
     * bind click and hover functions to the div element
     * @param curData = currentDataPoints after refreshed
     */
    function loadBarUI(curData) {

        var barData = loadBarData(curData);

        var plot = $.plot($("#cpubar"), barData.data, barData.options);

        $("#cpubar").bind("plotclick", function (event, pos, item) {
            if (item)
            {
                plot.highlight(item.series, item.datapoint);
                loadDrillDown(item);
                setTimeout(function() { plot.unhighlight(item.series, item.datapoint) }, 1000);
            }
        });

        $("#cpubar").bind("plothover", function (event, pos, item) {
            if (item)
            {
                if (previousPoint != item.dataIndex && item.dataIndex < currentDataPoints.length)
                {
                    var server = sortServers(currentDataPoints)[item.dataIndex];

                    var text = $("#flotTip").text();
                    $("#flotTip").text(server.server + ": " + text);
                }
            }
        });
    };

    /**
     * TODO Break this up into multiple parts.
     *
     * parse the current data into barGraph form
     * two bars means two arrays inside an array for data
     * setup ticks(xaxis values) manually to override the default
     * use tooltip flot plugin to generate it.
     *
     * @param input = currentDataPoints after being refreshed
     * @returns { data, options }
     */
    function loadBarData(input) {

        var barView = $("#pickFormat").val();

        var cpuBars = {
            data: [],
            color: CPU_COLOR,
            label: "CPU",
            bars: {
                show: true,
                align: 'center',
                barWidth:.8
            }
        };

       var memBars = {
           data: [],
           color: MEM_COLOR,
           label: "Memory",
           bars: {
               show: true,
               align: 'center',
               barWidth:.8
           }
       };

        if (barView == 'cpu') {
            memBars.bars.show = false;
            memBars.lines = {
                lineWidth: 3.25
            };
        } else if (barView == 'mem') {
            cpuBars.bars.show = false;
            cpuBars.lines = {
                lineWidth: 3.25
            };
        } else if (barView == 'side') {
            cpuBars.bars.order = 1;
            memBars.bars.order = 2;
            cpuBars.bars.barWidth = .25;
            memBars.bars.barWidth = .25;
        } else if (barView == 'stack') {
            cpuBars.bars.barWidth = .8;
            memBars.bars.barWidth = .8;
        }

        var ticks = [];
        if (input != undefined) {

            for (var i = 0; i < input.length;i++)
            {
                console.log("Server: " + input[i].server);

                var server = {
                    server: input[i].server,
                    data: input[i].data
                };
                if (server.data && server.data.length > 0)
                {
                    cpuBars.data.push([i, server.data[server.data.length - 1].cpu]);
                    memBars.data.push([i, server.data[server.data.length - 1].mem]);
                    var tick = 'null';
                    if (server.server && server.server.length > 4)
                    {
                        tick = server.server.substring((server.server.length - 4));
                    }

                    ticks.push([i, tick]);
                } // else discard
            }
        }
        var opt = {
            grid: {
                hoverable: true,
                clickable: true
            },
            legend: {

                position: "sw",
                backgroundOpacity:  0.8
            },
            xaxis: {
                   ticks: ticks,
                   tickLength: 0
            },
            yaxis: {
              min: 0,
              max: 100,
              tickSize: 20
            },
            tooltip: true,
            tooltipOpts: {
                content: "%s was %y.2%"
            }
        };
        return {
            data: [
                  cpuBars,
                  memBars
            ],
            options: opt
        };
    };

    /**
     * Handles UI formation of drillDownModal element
     *
     * @param item
     */
    function loadDrillDown(item) {

        if (item.dataIndex < currentDataPoints.length)
        {
            var server = sortServers(currentDataPoints)[item.dataIndex];

            // #drillDownHolder
            $("#drilldownModal").show();
            $("#drilldownModal").css('opacity', 0.95);
            $("#drillDownTitle").text("Server: " + server.server);

            var timeData = loadSingleTimeData(server);
            $.plot($("#drillDownHolder"), timeData.data, timeData.options);
        }
    };

    /**
     * Generates time graph data from a single server node object
     *
     * @param input
     * @returns {{data: *[], options: {grid: {hoverable: boolean}, xaxis: {mode: string, timezone: string, timeformat: string}, lines: {show: boolean}, points: {show: boolean}, tooltip: boolean, tooltipOpts: {content: string}}}}
     */
    function loadSingleTimeData(input) {
        var cpuLine = {
            label: "CPU",
            data: [],
            color: CPU_COLOR
        };
        var memLine = {
            label: "Memory",
            data: [],
            color: MEM_COLOR
        };

        for (var i = 0; i < input.data.length; i++)
        {
            cpuLine.data.push([input.data[i].time, input.data[i].cpu]);
            memLine.data.push([input.data[i].time, input.data[i].mem]);
        }

        var data = [cpuLine, memLine];
        var options = {
            zoom: {
                interactive: true
            },
            pan: {
                interactive: true
            },
            grid: {
                  hoverable: true
            },
            xaxis: {
                   mode: "time",
                   timezone: "browser",
                   timeformat: "%H:%M:%S"
            },
            yaxis: {
                min: 0,
                max: 100,
                tickSize: 20,
                zoomRange: [0,100]
            },
            lines: {
                   show: true
            },
            points: {
                    show: true
            },
            tooltip: true,
            tooltipOpts: {
                content: "%y.2%"
            }
        };
        return {
            data: data,
            options: options
        };
    };

    function loadGaugesUI2() {

        var averages = getAverages(currentDataPoints);

        // cpu data
        var cpuGauge = new JustGage(
            {
                id:    "cpuGauge",
                value: averages.cpu,
                min:   0,
                max:   100,
                valueFontColor: CPU_COLOR,
                title: "Average CPU"
            }
        );
        cpuGauge._dataType = 'cpu';
        var memGauge = new JustGage(
            {
                id:    "memGauge",
                value: averages.mem,
                min:   0,
                max:   100,
                valueFontColor: MEM_COLOR,
                title: "Memory"
            }
        );
        memGauge._dataType = 'mem';
        function refreshMe(data) {

            cpuGauge.refresh(data.cpu);
            memGauge.refresh(data.mem);

        }
        setTimeout(function() {
            refreshMe(getAverages(currentDataPoints));
        }, 30000);
    }

    /**
     * Gauges UI Controller
     *
     * get data, average the data
     * create the two UI's
     * display the two UI's
     * @param curData
     */
    function loadGaugesUI(curData) {

        var gaugeData = loadGaugesData(getAverages(curData));

        var optionsCPU = {
            xaxis: {
                ticks: [[0, "Avg. CPU"]],
                tickColor: "#282828"
            },
            yaxis: {
                min: 0,
                max: 100,
                tickSize: 10
            }
        };
        var optionsMEM = {
            xaxis: {
                ticks: [[0, "Avg. Mem"]],
                tickColor: "#282828"
            },
            yaxis: {
                min: 0,
                max: 100,
                tickSize: 10
            }
        };

        console.log(gaugeData);
        $.plot($("#cpuGauge"), [gaugeData.cpu], optionsCPU);
        $.plot($("#memGauge"), [gaugeData.mem], optionsMEM);

    };

    /**
     * Put data into correct format for the gauge
     *
     * @param averages
     * @returns {{cpu: {data: *[], color: *, bars: {show: boolean, align: string, barWidth: number}}, mem: {data: *[], color: *, bars: {show: boolean, align: string}}}}
     */
    function loadGaugesData(averages) {

        console.log(averages);

        var cpuBar = {
            data: [[0, averages.cpu]],
            color: getColor(averages.cpu),
            bars: {
                show: true,
                align: 'center',
                barWidth:.25

            }
        };

        var memBar = {
            data: [[0, averages.mem]],
            color: getColor(averages.mem),
            bars: {
                show: true,
                align: 'center'
            }
        };

        return {
            cpu: cpuBar,
            mem: memBar
        };
    };

    /**
     * Compute the averages for cpu and memory from data given
     * @param curData
     * @returns {{cpu: number, mem: number}}
     */
    function getAverages(curData) {

        var cpuSum = 0;
        var memSum = 0;
        var totalFound = 0;
        if (curData && curData.length > 0)
        {
            for(var i = 0; i < curData.length; i++)
            {
                if (curData[i].data.length > 0)
                {
                    cpuSum += curData[i].data[curData[i].data.length - 1].cpu;
                    memSum += curData[i].data[curData[i].data.length - 1].mem;
                    totalFound++;
                }
            }

            if (totalFound > 0)
            {
                return {
                    cpu: (cpuSum / totalFound),
                    mem: (memSum / totalFound)
                }

            } else {

                return {
                    cpu: 0,
                    mem: 0
                }
            }
        } else {
            return {
                cpu: 0,
                mem: 0
            }
        }

    };

    /**
     * Determine the color of the gauge
     *
     * @param average
     * @returns {string}
     */
    function getColor(average) {
        if (isNaN(average) === false)
        {
            if (average > 90) {
                return "#FF0000"; // red
            } else if (average > 80) {
                return "#FF7F00";
            } else if (average > 65) {
                return "#FFFF00";
            } else if (average > 50) {
                return "#A0D622";
            } else if (average > 25) {
                return "#0ED318";
            } else {
                return "#2276FF";
            }
        } else {
            return "#2276FF"
        }
    };


    /**
     * Sort current data by cpu and memory and update angular view to control table of data
     * @param curData
     */
    function loadSortUI(curData) {

        var tempData = getCurrentValues(curData);

        var sortedByCPU = [];
        var sortedByMem = [];

        tempData.sort(function(serverA, serverB) {
           return serverB.cpu - serverA.cpu;
        });

        for (var i = 0; i < 5 && i < tempData.length; i++)
        {
            sortedByCPU.push(tempData[i]);
        }

        tempData.sort(function(serverA, serverB) {
            return serverB.mem - serverA.mem;
        });

        for (var i = 0; i < 5 && i < tempData.length; i++)
        {
            sortedByMem.push(tempData[i]);
        }

        angular.element($("#topUsage")).scope().updateCPU(sortedByCPU);
        angular.element($("#topUsage")).scope().updateMem(sortedByMem);
        angular.element($("#topUsage")).scope().$apply();
    };


    function loadGroupsAverageTimeGraph(curData, groups) {

        // first find the server(s) with the most amount of data then find the server with the newest time stamp from the servers with most data
        // base the time values for all points on that servers times
        var timeArray = findLongestDataAndNewest(curData);

        // base the time values for all points on that servers times
        // final values

        var data = splitIntoGroupsAndAverage(curData, groups, timeArray.length);

        // copy the array with the time values for 2*numGroups
        // split the curData into the proper groups and find the average of each time point.

        var plotData = [];
        for(var i = 0; i < data.length; i++)
        {

            // cpu line for this group
            var cpuLine = {
                label: "CPU: " + data[i].groupName,
                data: []
            };

            // memory line for this group
            var memLine = {
                label: "MEM: " + data[i].groupName,
                data: []
            };

            for (var j = 0; j < data[i].cpuData.length && j  < timeArray.length; j++)
            {
                cpuLine.data.push([timeArray[j], data[i].cpuData[j]]);
                memLine.data.push([timeArray[j], data[i].memData[j]]);
            }

            plotData.push(memLine);
            plotData.push(cpuLine);

        }

        var options = {

            grid: {
                  hoverable: true,
                  clickable: true
            },
            legend: {

                position: "sw",
                backgroundOpacity:  0.8
            },
            xaxis: {
                mode: "time",
                timezone: "browser",
                timeformat: "%H:%M:%S"
            },
            yaxis: {
                min: 0,
                max: 100,
                tickSize: 20
            },
            lines: {
                show: true
            },
            points: {
                show: false
            },
            tooltip: true,
            tooltipOpts: {
                content: "%y.2%"
            }
        };

        var plot = $.plot($("#groupAverages"), plotData, options);

        $("#groupAverages").bind("plotclick", function (event, pos, item) {
            if (item)
            {
                var cpuOrMem = item.seriesIndex % 2; // 0 = MEM 1 = CPU
                var newIndex = item.seriesIndex;
                if (cpuOrMem === 1) {
                    newIndex = newIndex - 1;
                }
                newIndex = newIndex / 2;
                drillDownGroup(data[newIndex], timeArray, cpuOrMem);
            }
        });


        // plot!


    };

    function splitIntoGroupsAndAverage(curData, groups, size) {

        var ret = [];

        for (var i = 0; i < groups.length; i++)
        {
            var temp = {
                groupName: groups[i].name,
                groupId: groups[i].id,
                servers: [],
                cpuData: [],
                memData: [],
                counts: []
            };
            // fill data with empty set
            for (var h = 0; h < size; h++)
            {
                temp.cpuData[h] = 0.00;
                temp.memData[h] = 0.00;
                temp.counts[h] = 0;
            }

            // place all servers in this group into temp
            for (var j = 0; j < curData.length; j++)
            {
                if (curData[j].group == temp.groupId)
                {
                    temp.servers.push(curData[j]);
                }
            }

            // iterate through the servers in temp
            for (var k = 0; k < temp.servers.length; k++)
            {

                // iterate through the data in each server
                for (var m = temp.servers[k].data.length - 1, n = size - 1; m >= 0; m--)
                {
                    temp.cpuData[n] = temp.cpuData[n] + temp.servers[k].data[m].cpu;
                    temp.memData[n] = temp.memData[n] + temp.servers[k].data[m].mem;
                    temp.counts[n] = temp.counts[n] + 1;
                    n--;
                }

            }

            // finally iterate through and calculate the averages
            for (var p = 0; p < size; p++)
            {
                if (temp.counts[p] > 0)
                {
                    temp.cpuData[p] = temp.cpuData[p] / temp.counts[p];
                    temp.memData[p] = temp.memData[p] / temp.counts[p];
                }
            }

            console.log("Temp: " + temp);
            ret.push(temp);

        }

        return ret;

    }


    function findLongestDataAndNewest(curData) {

        var ret = [];
        var sortedServers = sortServersByDataLength(curData);
        if (sortedServers.length > 0) {

            var myServer = sortedServers[0];

            for (var i = 0; i < myServer.data.length; i++) {
                ret.push(myServer.data[i].time);
            }
        }
        return ret;

    }


    /**
     * Goes through current data and returns all servers with their latest data point
     *
     * @param curData
     * @returns Array [ { server, cpu, mem } ]
     *
     */
    function getCurrentValues(curData) {

        var ret = [];

        for (var i = 0; i < curData.length; i++)
        {
            var aServer = {
                server: curData[i].server,
                cpu: 0.00,
                mem: 0.00
            };
            if (curData[i].data.length > 0)
            {
                aServer.cpu = curData[i].data[curData[i].data.length - 1].cpu;
                aServer.mem = curData[i].data[curData[i].data.length - 1].mem;
            }
            ret.push(aServer);
        }
        return ret;

    };

    function getIdByName(name) {

        var temp = sortServers(currentDataPoints);

        for(var i = 0; i < temp.length; i++)
        {
            if (temp[i].server == name)
            {
                console.log("i:" + i);
                return i;
            }
        }
        console.log("i: -1");
        return -1;

    };

    function sortServersByDataLength(servers) {

        var servers2 = servers.sort(function (a, b) {

            return b.data.length - a.data.length;

        });
        return servers2;

    };


    function drillDownGroup(group, timeArray, option) {

        console.log("drillDownGroup");
        console.log(group);
        var label = " (CPU)";
        if (option === 0) {
            label = " (Memory)";
        }
        console.log(label);

        $("#drilldownModal").show();
        $("#drilldownModal").css('opacity', 0.95);
        $("#drillDownTitle").text("Group: " + group.groupName + label);


        var timeData = loadMultipleTimeData(group.servers, timeArray, option);
        var aPlot = $.plot($("#drillDownHolder"), timeData.data, timeData.options);

        $("#drillDownHolder").bind("plothover", function (event, pos, item) {
            if (item)
            {
                if (previousPoint1 != item.seriesIndex && item.seriesIndex < group.servers.length)
                {
                    var server = group.servers[item.seriesIndex];

                    var text = $("#flotTip").text();
                    $("#flotTip").text(server.server + ": " + text);
                }
            }
        });

        // drill down inside a drill down...
        $("#drillDownHolder").bind("plotclick", function (event, pos, item) {
           if (item) {
               var server = group.servers[item.seriesIndex];
               $.external_callLoadDrillDown(server.server);

           }
        });
    }

    function loadMultipleTimeData(servers, timeArray, option) {

        var plotData = [];
        for(var i = 0; i < servers.length; i++)
        {

            var newLine = {
                data: []
            };


            for (var j = 0; j < servers[i].data.length && j  < timeArray.length; j++)
            {
                if (option === 1) {
                    newLine.data.push([timeArray[j], servers[i].data[j].cpu]);
                } else {
                    newLine.data.push([timeArray[j], servers[i].data[j].mem]);
                }
            }

            plotData.push(newLine);
        }

        var options = {

            series: {
                downsample: {
                    threshold: 500 // 0 disables downsampling for this series.
                }
            },
            grid: {
                hoverable: true,
                clickable: true
            },
            xaxis: {
                mode: "time",
                timezone: "browser",
                timeformat: "%H:%M:%S"
            },
            yaxis: {
                min: 0,
                max: 100,
                tickSize: 20
            },
            lines: {
                show: true
            },
            points: {
                show: false
            },
            tooltip: true,
            tooltipOpts: {
                content: "%y.2%"
            }
        };

        return {
            data: plotData,
            options: options
        }

    }


    $.external_callLoadDrillDown = function (serverName) {

        var id = getIdByName(serverName);
        if (id >= 0)
        {
            loadDrillDown({dataIndex: id});
        }
    };
    // click events

    $("#modalClose").click(function() {
        $("#drilldownModal").hide();
        $("#drilldownModal").css('opacity', 0);
        $("#drillDownTitle").text("Server: ");
    });


    // force refresh every 30 minutes
    // No longer doing this.  Why because we want to remove the need to refresh or rebuild data?
    setTimeout(function() {

        // location.reload(true);

    }, 1800000);
};

$("#pickFormat").change(function () {
    var newUrl = (document.URL).toString().split('?')[0];
    newUrl = newUrl + '?view=' + $("#pickFormat").val();
    document.location.href=newUrl;
});


function getFirstData(callback) { // dashboardSettingsUrl (change to this soon)


    syncDB(false, function () {

        loadDashboardSettings(callback);

    });

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
                           if (cb && typeof cb === 'function') {
                               cb();
                           }
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

}


function placeValuesInStorage(data) {

    var dbServerPrefix = 'db:server:',
        dbGroupPrefix = 'db:group:',
        dbDashPrefix = 'db:dashboard:',
        dbFrontsPrefix = 'db:front:',
        dbDataTypesPrefix = 'db:dataTypes:';

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


/*

 var dbServerPrefix = 'db:server:';
 var dbGroupPrefix = 'db:group:';


 */


function loadDashboardSettings (cb) {

    var dbServerPrefix = 'db:server:';
    var dbGroupPrefix = 'db:group:';
    var serverPrefix = 'server:';
    var groupPrefix = 'group:';

    var settingsUrl = sessionStorage.getItem("dashboardSettingsUrl");

    if (settingsUrl != null) {

        $.get(settingsUrl).done( function( inData ) {

            if (inData && inData.dashboard) {

                console.log("Data Availible");

                // sessionStorage will hold the dashboard value

                sessionStorage.setItem("dashboard", JSON.stringify(inData.dashboard));


                var groups = inData.groups || [];
                var groupList = [];

                // session will hold "group:ID:servers" = [1,2,3,8];
                // and "groups" = [1,2,3]

                for (var i = 0; i < groups.length; i++)
                {
                    // add to localStorage if it doesn't exist
                    if (localStorage.getItem(dbGroupPrefix + groups[i].id) === null) {
                        localStorage.setItem(dbGroupPrefix + groups[i].id, JSON.stringify(groups[i]));
                    }
                    sessionStorage.setItem(groupPrefix + groups[i].id + ':servers', JSON.stringify([]));
                    groupList.push(groups[i].id);
                }


                sessionStorage.setItem('groups', JSON.stringify(groupList));

                // session will hold "server:ID:data" = [{ time: 0, cpu: 0, mem: 1 }, { time: 0, cpu: 0, mem: 1 }]; sorted by time (oldest, newest)
                // "server:HOSTNAME" = "id"; allows for lookup by name quickly
                // "servers" = [1,2,3,8]; ids of servers

                var servers = inData.servers || [];
                var serverList = [];

                for (var i = 0; i < servers.length; i++) {

                    serverList.push(servers[i].id);

                    // Add to localStorage if not found
                    if (localStorage.getItem(dbServerPrefix + servers[i].id) === null) {
                        localStorage.setItem(dbServerPrefix + servers[i].id, JSON.stringify(servers[i]));
                    }

                    sessionStorage.setItem((serverPrefix + servers[i].hostName), servers[i].id);
                    sessionStorage.setItem((serverPrefix + servers[i].id + ':data'), JSON.stringify([]));

                    for (var j = 0; j < servers[i].groups.length; j++) {

                        var temp = sessionStorage.getItem(groupPrefix + servers[i].groups[j] + ':servers');
                        var newVal = [];
                        if (temp != null) {
                            newVal = JSON.parse(temp);
                        }
                        newVal.push(servers[i].id);
                        sessionStorage.setItem(groupPrefix + servers[i].groups[j] + ':servers', JSON.stringify(newVal));
                    }
                }
                sessionStorage.setItem('servers', JSON.stringify(serverList));

                console.log("Successfully loaded session settings data");

                if (cb && typeof cb === 'function') {
                    cb(true);
                }

            } else {
                console.log("This should have never happened.  Dashboard should always be there");
                if (cb && typeof cb === 'function') {
                    cb(false);
                }
            }
        }).fail( function () {

            console.log("dashboard failed to load settings");
            if (cb && typeof cb === 'function') {
                cb(false);
            }

        });

    } else {
        if (cb && typeof cb === 'function') {
            cb(false);
        }
    }
}


function sortServers(servers) {

    return servers.sort(function (a, b) { // sort before saving
        if (a.server < b.server)
        {
            return -1;
        } else if (a.server > b.server) {
            return 1;
        } else {
            return 0;
        }
    });
}

/*

Overview of json data

 [
    {
        "server": "moc-lx00009001",
        "data": [
            {
                "time": 1397860792000,
                "cpu": 14.43,
                "mem": 28.34
            }
        ],
        "group": 0
    }
 ]

 */