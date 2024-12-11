import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {getStateFromUrl, clearZeiteinheitSelection} from '../../src/functions.js';
import {getCommonConnectors} from '../../src/common_connectors.js';
import {getFilterComponent, getDayRangeButtonsComponent} from "../../src/common_components.js";
import {setupEventListeners} from "../../src/eventListeners.js";

export default async function setupBoard() {
    const initialState = getStateFromUrl();

    const state = {
        activeType: initialState.activeType,
        activeStrtyp: initialState.activeStrtyp,
        activeZst: initialState.activeZst,
        activeFzgtyp: initialState.activeFzgtyp,
        activeTimeRange: initialState.activeTimeRange,
        weekday: initialState.weekday
    };

    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
                ...getCommonConnectors(),
            {
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
        components: [
                getFilterComponent(),
        {
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
                        [Date.UTC(2014, 1, 1), 0],
                        [Date.UTC(2024, 3, 10), 0]
                    ],
                    color: '#6f6f6f',
                    connectNulls: false
                }],
                xAxis: {
                    min: state.activeTimeRange[0],
                    max: state.activeTimeRange[1],
                    minRange: 24 * 3600 * 1000, // 1 day
                    events: {
                        afterSetExtremes: async function (e) {
                            const newState = getStateFromUrl();
                            const min = Math.round(e.min);
                            const max = Math.round(e.max);

                            // Uncheck "Zeitraum" options
                            clearZeiteinheitSelection();
                            if (newState.activeTimeRange[0] !== min || newState.activeTimeRange[1] !== max) {
                                const activeTimeRange = [min, max];
                                await updateBoard(
                                    board,
                                    newState.activeType,
                                    newState.activeStrtyp,
                                    newState.activeZst,
                                    newState.activeFzgtyp,
                                    activeTimeRange,
                                    false
                                );
                            }
                        }
                    }
                }
            }
        },
            getDayRangeButtonsComponent(state.weekday),
        {
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
                header: [],
                columns: [],
                credits: {
                    enabled: true
                }
            }

        }, {
            cell: 'hourly-dtv-chart',
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
                    height: '500px'
                },
                tooltip: {
                    shared: true, // Allows multiple series to share the tooltip
                    formatter: function () {
                        // Access the categories array from xAxis
                        const categories = this.series.chart.options.xAxis[0].categories;
                        // Get the category for the current x value
                        const category = categories[this.points[0].point.x];
                        let tooltipText = `<b>${category}</b><br/>`;
                        this.points.forEach(point => {
                            tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: `;
                            tooltipText += `<b>${Highcharts.numberFormat(point.y, 0)}</b><br/>`;
                        });

                        return tooltipText;
                    }
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
                    text: 'Durchschnittlicher Stundenverkehr'
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
                        text: 'Durchschnittlicher Stundenverkehr'
                    }
                },
                series: [],
                credits: {
                    enabled: true
                },
                accessibility: {
                    description: 'A line chart showing the average daily traffic (DTV) aggregated hourly for the selected counting station.',
                    point: {
                        valueDescriptionFormat: 'Hour: {xDescription}. Average hourly traffic: {value}.'
                    }
                }
            }
        },
            {
                cell: 'hourly-donut-chart',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'pie',
                        height: '450px',
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
                                        'Gesamtquerschnitt:<br/>DTV: ' + formattedTotal + '<br/>%',
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
                        series: {
                            type: 'pie',
                            colorByPoint: true,
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
                                            // Format the value and percentage with spaces
                                            var formattedValue = Highcharts.numberFormat(this.y, 0, '.', ' ');
                                            var formattedPercentage = Highcharts.numberFormat(this.percentage, 1, '.', ' ');
                                            chart.lbl.attr({
                                                text: this.name + ':<br/>DTV: ' + formattedValue + '<br/>' + formattedPercentage + '%'
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
                                                text: 'Gesamtquerschnitt:<br/>DTV: ' + formattedTotal + '<br/>'
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    },
                    series: [{
                        type: 'pie',
                        name: 'Anzahl',
                        data: [] // Placeholder, updated dynamically in updateBoard
                    }],
                    credits: {
                        enabled: true
                    },
                    accessibility: {
                        description: 'A donut chart showing the distribution of traffic directions over the day.',
                        point: {
                            valueDescriptionFormat: '{point.name}: {point.y}, {point.percentage:.1f}%.'
                        }
                    }
                }
            },
            {
                cell: 'hourly-box-plot',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'boxplot',
                        height: '400px'
                    },
                    title: {
                        text: 'Verteilung des Stundenverkehrs'
                    },
                    xAxis: {
                        categories: [
                            '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
                            '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
                            '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
                        ],
                        title: {
                            text: 'Monat'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anzahl'
                        }
                    },
                    series: [],
                    tooltip: {
                        headerFormat: '<em>Stunde: {point.key}</em><br/>',
                        pointFormat:
                            '<span style="color:{series.color}">{series.name}</span><br/>' +
                            'Min: {point.low}<br/>' +
                            'Q1: {point.q1}<br/>' +
                            'Median: {point.median}<br/>' +
                            'Q3: {point.q3}<br/>' +
                            'Max: {point.high}<br/>'
                    },
                    plotOptions: {
                        boxplot: {
                            fillColor: '#F0F0E0',
                            lineWidth: 2,
                            medianColor: '#0C5DA5',
                            medianWidth: 3,
                            stemColor: '#A63400',
                            stemDashStyle: 'dot',
                            stemWidth: 1,
                            whiskerColor: '#3D9200',
                            whiskerLength: '20%',
                            whiskerWidth: 3
                        }
                    },
                    credits: {
                        enabled: true
                    },
                    accessibility: {
                        description: 'A box plot showing the distribution of hourly traffic over the day.',
                        point: {
                            valueDescriptionFormat: 'Minimum: {point.low}, Q1: {point.q1}, Median: {point.median}, Q3: {point.q3}, Maximum: {point.high}.'
                        }
                    }
                }
            }],
    }, true);

    setupEventListeners(updateBoard, board);

    // Load active counting station
    await updateBoard(
        board,
        state.activeType,
        state.activeStrtyp,
        state.activeZst,
        state.activeFzgtyp,
        state.activeTimeRange,
        true
    );
}