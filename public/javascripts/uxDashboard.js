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


    // functions for handling data and loading dynamic ui elements
    // flot is used for graphs / charts

    function loadData() {

        $.get('/api/noc/ux').success( function( jdata ) {

            if (jdata && jdata.length > 0) {

                currentData = jdata;

                loadBarUI(currentData);

            }
        });
        setTimeout(function() { loadData(); }, 30000);
    };

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
            } else {
                $("#cpubarLabel").hide();
            }
        });
    };

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
            tooltip: true,
            tooltipOpts: {
                         content: "%s was %y.2%"
            }
        };
        var ret = {
            data: [
                  cpuBars,
                  memBars
            ],
            options: opt
        };
        return ret;
    };

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


    // click events

    $("#modalClose").click(function() {
        $("#drilldownModal").hide();
        $("#drilldownModal").css('opacity', 0);
        $("#drillDownTitle").text("Server: ");
    });

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