/**
 * Created by Derek Rada on 4/18/2014.
 */

$(document.body).ready(function() {

    var dashboardId = $("#hiddenField").data('did');
    console.log("Document Ready");
    safeHandler(dashboardId);
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
   }]
);

function safeHandler(dataId) {

    "use strict";

    // global
    var currentDataPoints,
        currentGroups = [],
        previousPoint = null,
        dashboardDataUrl = '/api/data/',
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

    /**
     *  Load data from JSON API
     *
     *  connect to API and get server data points
     *  loadThe UI Elements dynamically using flot
     *  call itself in 30 seconds
     *
     */

     // run at start
    loadData();


    function loadData() {

        $.get(dashboardDataUrl).success( function( inData ) {

            console.log("performed loadData");
            console.log(inData);

            if (inData && inData.servers && inData.servers.length > 0) {

                console.log("inside load if of loadData");

                currentDataPoints = inData.servers;
                currentGroups = inData.groups || [];

                console.log(currentDataPoints);

                loadBarUI(currentDataPoints);
                loadGaugesUI(currentDataPoints);
                loadSortUI(currentDataPoints);
            }
        });
        setTimeout(function() { loadData(); }, 30000);
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
                    var server = currentDataPoints[item.dataIndex];

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
        var cpuBars = {
            data: [],
            color: CPU_COLOR,
            label: "CPU",
            bars: {
                show: true,
                align: 'center',
                barWidth:.25,
                order: 1
            }
        };
       var memBars = {
           data: [],
           color: MEM_COLOR,
           label: "Memory",
           bars: {
               show: true,
               align: 'center',
               barWidth:.25,
               order: 2
           }
       };
        var ticks = [];
        if (input != undefined) {

            for (var i = 0; i < input.length;i++)
            {

                var server = {
                    server: input[i].server,
                    data: input[i].data
                };
                if (server.data && server.data.length > 0)
                {
                    cpuBars.data.push([i, server.data[server.data.length - 1].cpu]);
                    memBars.data.push([i, server.data[server.data.length - 1].mem]);
                    ticks.push([i, server.server]);
                } // else discard
            }
        }
        var opt = {
            grid: {
                hoverable: true,
                clickable: true
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
            var server = currentDataPoints[item.dataIndex];

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
            grid: {
                  hoverable: true
            },
            xaxis: {
                   mode: "time",
                   timezone: "browser",
                   timeformat: "%H:%M:%S"
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

        for(var i = 0; i < currentDataPoints.length; i++)
        {
            if (currentDataPoints[i].server == name)
            {
                console.log("i:" + i);
                return i;
            }
        }
        console.log("i: -1");
        return -1;

    };

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
    setTimeout(function() {

        location.reload(true);

    }, 1800000);

};

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