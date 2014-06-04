/**
 * Created by Derek Rada on 5/22/2014.
 */

var FlotHelper = function () {

    var self = this;

    self.loadMultiServerTimeGraph = function(elementId, data, dataTypes, range) {

        var plotData = [];
        console.log("data.length: " + data.length);
        var xRangeStart = range.start;
        var xRangeEnd = range.end;
        for(var i = 0; i < data.length; i++)
        {
            // cpu line for this group
            for (var h = 0;h < dataTypes.length; h++) {

                var aLine = {
                    label: dataTypes[h] + " " + data[i].server,
                    data: []
                };

                for (var j = 0; j < data[i].data.length; j++)
                {
                    if (data[i].data[j].time >= xRangeStart && data[i].data[j].time <= xRangeEnd)
                    {
                        aLine.data.push([data[i].data[j].time, data[i].data[j][dataTypes[h]]]);
                    }

                    /* cpuLine.data.push([data[i].data[j].time, data[i].data[j].cpu]);
                    memLine.data.push([data[i].data[j].time, data[i].data[j].mem]);*/
                }
                plotData.push(aLine);

            }
            /*var cpuLine = {
                label: "CPU: " + data[i].server,
                data: []
            };

            // memory line for this group
            var memLine = {
                label: "MEM: " + data[i].server,
                data: []
            };*/
/*
            for (var j = 0; j < data[i].data.length; j++)
            {
                if (xRangeStart === 0 || xRangeStart > data[i].data[j].time) {
                    xRangeStart = data[i].data[j].time;
                }
                if (xRangeEnd === 0 || xRangeEnd < data[i].data[j].time) {
                    xRangeEnd = data[i].data[j].time;
                }
                cpuLine.data.push([data[i].data[j].time, data[i].data[j].cpu]);
                memLine.data.push([data[i].data[j].time, data[i].data[j].mem]);
            }

            plotData.push(memLine);
            plotData.push(cpuLine);*/
        }

        console.log(plotData);
        var thresh = 2;
        thresh += data.length;


        var options = {

            series: {
                downsample: {
                    threshold: Math.ceil($(elementId).width() / thresh) // 0 disables downsampling for this series.
                }
            },
           zoom: {
             interactive: true
           },

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
                timeformat: "%d %H:%M",
                zoomRange: [xRangeStart, xRangeEnd]

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

        console.log("plotData: " + plotData);

        var plot = $.plot($(elementId), plotData, options);

    };


};