/**
 * Created by Derek Rada on 4/18/2014.
 */

$(document.body).ready(function() {
    safeHandler($);
});

function safeHandler($) {

    "use strict";

    // run at start
    loadData();

    // global
    var currentData,
        previousPoint = null;

    // static
    var CPU_COLOR = "#00B7FF",
        MEM_COLOR = "#FFB700";


    // functions

    /**
     *  Load data from JSON API
     *
     *  connect to API and get server data points
     *  loadThe UI Elements dynamically using flot
     *  call itself in 30 seconds
     *
     */
    function loadData() {

        $.get('/api/noc/ux').success( function( inData ) {

            if (inData && inData.length > 0) {

                currentData = inData;

                loadBarUI(currentData);
                loadGaugesUI(currentData);
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
     * @param curData = currentData after refreshed
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
                if (previousPoint != item.dataIndex && item.dataIndex < currentData.length)
                {
                    var server = currentData[item.dataIndex];

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
     * @param input = currentData after being refreshed
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
              tickSize: 10
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

        if (item.dataIndex < currentData.length)
        {
            var server = currentData[item.dataIndex];

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
 ]
 }
 ]

 */