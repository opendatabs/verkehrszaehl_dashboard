import {gui} from './layout.js';
import {updateBoard} from './update.js';

setupBoard().then(r => console.log('Board setup complete'));
async function setupBoard() {
    let activeCountingStation = '404',
        activeTimeRange = [ // default to a year
            Date.UTC(2023, 1, 1, 0, 0, 1),
            Date.UTC(2023, 12, 31)
        ],
        activeType = 'MIV',
        isManualSelection = false;

    // Initialize board with most basic data
    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [{
                id: 'Data',
                type: 'CSV',
                options: {
                    csvURL: `./data/MIV/404_hourly.csv`
                }
            }, {
                id: 'Hourly Traffic',
                type: 'JSON',
                options: {
                    dataModifier: {
                        'type': 'Math',
                    }
                }
            }]
        },
        gui,
        components: [{
            cell: 'time-range-selector',
            type: 'Navigator',
            chartOptions: {
                chart: {
                    height: '100px',
                    type: 'line'
                },
                series: [{
                    name: 'DailyTraffic',
                    data: [
                        [Date.UTC(2000, 1, 1), 0],
                        [Date.UTC(2024, 3, 10), 0]
                    ]
                }, {
                    name: '7-Day Rolling Average',
                    data: [
                        [Date.UTC(2000, 1, 1), 0],
                        [Date.UTC(2024, 3, 10), 0]
                    ]
                }],
                xAxis: {
                    min: activeTimeRange[0],
                    max: activeTimeRange[1],
                    minRange: 30 * 24 * 3600 * 1000, // 30 days
                    events: {
                        afterSetExtremes: async function (e) {
                            const min = Math.round(e.min);
                            const max = Math.round(e.max);

                            if (activeTimeRange[0] !== min || activeTimeRange[1] !== max) {
                                activeTimeRange = [min, max];
                                await updateBoard(
                                    board,
                                    activeCountingStation,
                                    true,
                                    activeType,
                                    activeTimeRange
                                ); // Refresh board on range change
                            }
                        }
                    }
                }
            }
        }, {
            cell: 'filter-section-2',
            type: 'HTML',
            html: `
                    <div id="day-range-buttons">
                        <input type="checkbox" id="mo-fr" value="Mo-Fr" checked>
                        <label for="mo-fr">Mo-Fr</label>
                        <input type="checkbox" id="sa-so" value="Sa-So" checked>
                        <label for="sa-so">Sa+So</label>
                    </div>
                `
        }, {
            renderTo: 'hour-table',
            type: 'DataGrid',
            connector: {
                id: 'Hourly Traffic'
            },
            sync: {
                highlight: {
                    enabled: true,
                    autoScroll: true
                }
            },
            dataGridOptions: {
                editable: false,
                header: [
                    {
                        columnId: "stunde",
                    },
                    {
                        format: "Durchschnittlicher Tagesverkehr",
                        columns: [
                            "dtv_ri1",
                            "dtv_ri2",
                            "dtv_total",
                            "dtv_anteil"
                        ]
                    }
                ],
                columns: [
                    {
                        id: 'stunde',
                        header: {
                            format: 'Stunden'
                        }
                    },
                    {
                        id: 'dtv_ri1',
                        header: {
                            format: 'Ri. I'
                        },
                        cells: {
                            format: '{value:.0f}'
                        }
                    },
                    {
                        id: 'dtv_ri2',
                        header: {
                            format: 'Ri. II'
                        },
                        cells: {
                            format: '{value:.0f}'
                        }
                    },
                    {
                        id: 'dtv_total',
                        header: {
                            format: 'Ri. I+II'
                        },
                        cells: {
                            format: '{value:.0f}'
                        }
                    },
                    {
                        id: 'dtv_anteil',
                        header: {
                            format: 'Anteil Std. am Tag'
                        },
                        cells: {
                            format: '{value:.1f} %'
                        }
                    }
                ],
            }
        }, {
            cell: 'hourly-dtv-graph',
            type: 'Highcharts',
            connector: {
                id: 'Hourly Traffic',
                columnAssignment: [{
                    seriesId: 'series-ri1',
                    data: 'dtv_ri1'
                }, {
                    seriesId: 'series-ri2',
                    data: 'dtv_ri2'
                }, {
                    seriesId: 'series-gesamt',
                    data: 'dtv_total'
                }]
            },
            sync: {
                highlight: true
            },
            chartOptions: {
                chart: {
                    type: 'line',
                    height: '400px'
                },
                tooltip: {
                    useHTML: true,
                    formatter: function () {
                        return `
                                    <b style="color:${this.series.color}">${this.series.name}</b><br>
                                    Stunde: <b>${this.point.category}</b><br>
                                    Anzahl Fahrzeuge pro Stunde: <b>${Highcharts.numberFormat(this.point.y, 0)}</b>
                               `;
                    },
                    shared: false
                },
                plotOptions: {
                    series: {
                        states: {
                            hover: {
                                enabled: true,
                                lineWidthPlus: 2,
                                halo: {
                                    size: 0
                                }
                            }
                        }
                    }
                },
                title: {
                    text: 'Durchschnittlicher Tagesverkehr (DTV)'
                },
                xAxis: {
                    categories: [
                        '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
                        '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
                        '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
                    ],
                    title: {
                        text: 'Stunde'
                    },
                    labels: {
                        rotation: -45,
                        step: 1
                    }
                },
                yAxis: {
                    title: {
                        text: 'Anz. Fzg/h'
                    }
                },
                series: [
                    {
                        id: 'series-ri1',
                        name: 'Richtung 1',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        }
                    },
                    {
                        id: 'series-ri2',
                        name: 'Richtung 2',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        }
                    },
                    {
                        id: 'series-gesamt',
                        name: 'Gesamtquerschnitt',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        }
                    }],
                accessibility: {
                    description: 'A line chart showing the average daily traffic (DTV) aggregated hourly for the selected counting station.',
                    typeDescription: 'A line chart showing DTV aggregated hourly.'
                }
            }
        },
            {
                cell: 'hourly-donut-chart',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'pie',
                        height: '400px',
                        events: {
                            // Event handler for when the chart is loaded
                            load: function() {
                                var total = 0;
                                this.series[0].data.forEach(function(point) {
                                    total += point.y;
                                });
                                // Format the total with spaces as thousands separator
                                var formattedTotal = Highcharts.numberFormat(total, 0, '.', ' ');
                                // Create a label in the center of the donut chart with a newline after 'Gesamtquerschnitt'
                                if (!this.lbl) {
                                    this.lbl = this.renderer.text(
                                        'Gesamtquerschnitt:<br/>' + formattedTotal + ' Fzg. pro Tag <br/> 100%',
                                        this.plotWidth / 2 + this.plotLeft,
                                        this.plotHeight / 2 + this.plotTop - 20, // Adjusted vertical position
                                        true // Enable HTML rendering
                                    )
                                        .attr({
                                            align: 'center',
                                            zIndex: 10
                                        })
                                        .css({
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            textAlign: 'center' // Ensure center alignment
                                        })
                                        .add();
                                }
                            }
                        }
                    },
                    title: {
                        text: 'Anteil der Verkehrsrichtungen am Tagesverkehr'
                    },
                    tooltip: {
                        pointFormat: '{point.name}: <b>{point.y:.0f}</b> ({point.percentage:.1f}%)'
                    },
                    plotOptions: {
                        pie: {
                            innerSize: '70%', // Increase inner size to make a larger hole
                            dataLabels: {
                                enabled: false,
                                format: '{point.name}: {point.y} ({point.percentage:.1f}%)',
                                distance: -40, // Negative distance to position labels inside slices
                                style: {
                                    fontSize: '14px',
                                    color: 'white',
                                    textOutline: 'none'
                                },
                                connectorWidth: 0, // Remove connector lines
                                crop: false,
                                overflow: 'none'
                            },
                            point: {
                                events: {
                                    // Event handler for when a segment is hovered over
                                    mouseOver: function() {
                                        var chart = this.series.chart;
                                        if (chart.lbl) {
                                            // Extract the number from the direction name
                                            var match = this.name.match(/\d+/); // Extract digits from the name
                                            var richtungNummer = match ? match[0] : this.name;
                                            // Format the value and percentage with spaces
                                            var formattedValue = Highcharts.numberFormat(this.y, 0, '.', ' ');
                                            var formattedPercentage = Highcharts.numberFormat(this.percentage, 1, '.', ' ');
                                            chart.lbl.attr({
                                                text: 'Richtung ' + richtungNummer + ':<br/>' + formattedValue + ' Fzg. pro Tag<br/>' + formattedPercentage + '%'
                                            });
                                        }
                                    },
                                    // Event handler for when the mouse leaves a segment
                                    mouseOut: function() {
                                        var chart = this.series.chart;
                                        var total = 0;
                                        chart.series[0].data.forEach(function(point) {
                                            total += point.y;
                                        });
                                        var formattedTotal = Highcharts.numberFormat(total, 0, '.', ' ');
                                        if (chart.lbl) {
                                            chart.lbl.attr({
                                                text: 'Gesamtquerschnitt:<br/>' + formattedTotal + ' Fzg. pro Tag<br/>100%'
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    },
                    series: [{
                        name: 'Traffic',
                        colorByPoint: true,
                        data: [] // Placeholder, updated dynamically in updateBoard
                    }],
                    accessibility: {
                        description: 'A donut chart showing the distribution of traffic directions over the day.',
                        point: {
                            valueDescriptionFormat: '{point.name}: {point.y}, {point.percentage:.1f}%.'
                        }
                    }
                }
            }],
    }, true);
    const dataPool = board.dataPool;

    document.querySelectorAll('#day-range-buttons input').forEach(button => {
        button.checked = true; // Ensure both are selected by default
        button.addEventListener('change', async (event) => {
            const moFr = document.querySelector('#mo-fr');
            const saSo = document.querySelector('#sa-so');

            // Ensure at least one button is always selected
            if (!moFr.checked && !saSo.checked) {
                event.target.checked = true; // Prevent unchecking the last selected button
            } else {
                // Update the board based on the new selection
                await updateBoard(board, activeCountingStation, true, activeType, activeTimeRange);
            }
        });
    });

    // Load active counting station
    await updateBoard(board,
        activeCountingStation,
        true,
        activeType,
        activeTimeRange);
}

window.setupBoard = setupBoard;