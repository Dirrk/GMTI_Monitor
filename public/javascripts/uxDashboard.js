/**
 * Created by Derek Rada on 4/18/2014.
 */

$(document.body).ready(function() {
    safeHandler($);
});

function safeHandler($) {

    "use strict";

    loadUXBar($);

    function loadUXBar($) {

        $.get('/api/noc/ux').success( function( jdata ) {

            if (jdata && jdata.length > 0) {

                var barData = loadBarData(jdata);
                console.log(barData);

                $.plot($("#cpubar"), barData.data, barData.options);
            }
        });
    }


    function loadBarData(input) {
        var cpuBars = {
            data: [],
            color: "#00B7FF",
            label: "CPU",
            bars: {
                show: true,
                align: 'center',
                barWidth: 0.2,
                order: 1
            }
        };
       var memBars = {
           data: [],
           color: "#FFB700",
           label: "Memory",
           bars: {
               show: true,
               align: 'center',
               barWidth: 0.2,
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
            xaxis: {
                   ticks: ticks,
                   tickLength: 0
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
    }

    function loadUXTime($) {
        // load uxTime
    }

    /*
    function getServerData(input, iterator) {
        var ret = null;
        if (input) {


            var ret = {
                label: input.server || "server-" + (Math.random() * 1000).toString(),
                data: [],
                bars: {
                    show:      true,
                    fill:      true,
                    lineWidth: 1,
                    order:     iterator || undefined,
                    fillColor: "#FFFFFF"
                },
                color: "#FFFFF"
            }
        }
        return ret;
    }
    */
};

/*

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