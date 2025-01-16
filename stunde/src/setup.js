import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {getStateFromUrl} from '../../src/functions.js';
import {getCommonConnectors} from '../../src/common_connectors.js';
import {getFilterComponent, getDayRangeButtonsComponent} from "../../src/common_components.js";
import {setupEventListeners} from "../../src/eventListeners.js";

export default async function setupBoard() {
    Highcharts.setOptions({
        lang: {
            locale: 'de-CH',
            decimalPoint: '.',
            thousandsSep: "'",
        }
    });

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
                exporting: {
                    enabled: false
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
                        afterSetExtremes: (function () {
                            let debounceTimer = null;

                            return async function (e) {
                                // Clear the existing timer
                                if (debounceTimer) {
                                    clearTimeout(debounceTimer);
                                }

                                // Set a new debounce timer
                                debounceTimer = setTimeout(async () => {
                                    const currentState = getStateFromUrl();
                                    const min = Math.round(e.min);
                                    const max = Math.round(e.max);

                                    if (currentState.activeTimeRange[0] !== min || currentState.activeTimeRange[1] !== max) {
                                        const activeTimeRange = [min, max];
                                        await updateBoard(
                                            board,
                                            currentState.activeType,
                                            currentState.activeStrtyp,
                                            currentState.activeZst,
                                            currentState.activeFzgtyp,
                                            activeTimeRange,
                                            false,
                                            false
                                        );
                                    }
                                }, 300);
                            };
                        })()
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
                    formatter: function () {
                        const chart = this.series.chart;
                        const categories = chart.xAxis[0].categories;
                        const categoryIndex = this.x;
                        const hoveredSeries = this.series;
                        const category = categories[categoryIndex];

                        let tooltipText = `<b>${category}</b><br/>`;

                        chart.series.forEach(function (s) {
                            const point = s.points[categoryIndex];
                            if (point && point.y !== null && point.y !== undefined) {
                                const fontWeight = (s === hoveredSeries) ? 'bold' : 'normal';

                                tooltipText += `<span style="color:${s.color}">\u25CF</span> `;
                                tooltipText += `<span style="font-weight:${fontWeight}">${s.name}</span>: `;
                                tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 0)}</span><br/>`;
                            }
                        });
                        return tooltipText;
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
                series: [
                    {
                        id: `series-ri1`,
                        name: 'Richtung 1',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#007a2f'
                    },
                    {
                        id: `series-ri2`,
                        name: 'Richtung 2',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#008ac3'
                    },
                    {
                        id: `series-gesamt`,
                        name: 'Gesamtquerschnitt',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#6f6f6f'
                    }
                ],
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
        }, {
            cell: 'hourly-donut-chart',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'pie',
                    height: '450px',
                    events: {
                        load: function() {
                            // Create the label once
                            var total = 0;
                            this.series[0].data.forEach(function(point) {
                                total += point.y;
                            });
                            var formattedTotal = Highcharts.numberFormat(total, 0);

                            // Create the label in the center of the donut chart
                            this.lbl = this.renderer
                                .text(
                                    'Gesamtquerschnitt:<br/>DTV: ' + formattedTotal,
                                    0,
                                    0,
                                    true
                                )
                                .attr({
                                    align: 'center',
                                    zIndex: 10
                                })
                                .css({
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    textAlign: 'center'
                                })
                                .add();
                        },
                        render: function() {
                            // Reposition the label on every render (including after window resize)
                            if (this.lbl) {
                                this.lbl.attr({
                                    x: this.plotWidth / 2 + this.plotLeft,
                                    y: this.plotHeight / 2 + this.plotTop - 20
                                });
                            }
                        }
                    }
                },
                title: {
                    text: 'Anteil der Verkehrsrichtungen am Tagesverkehr'
                },
                tooltip: {
                    enabled: false,
                    formatter: function () {
                        return `<span style="color:${this.point.color}">\u25CF</span> ${this.point.name}: 
                                <b>${Highcharts.numberFormat(this.y, 0)}</b> (${this.percentage.toFixed(1)}%)`;
                    }
                },
                plotOptions: {
                    pie: {
                        allowPointSelect: false,
                        cursor: 'default',
                        colorByPoint: true,
                        innerSize: '70%',
                        dataLabels: {
                            enabled: true,
                            formatter: function () {
                                return `<span style="color:${this.point.color}">\u25CF</span> ${this.point.name} <br/> 
                                <b>DTV: ${Highcharts.numberFormat(this.y, 0)}</b> (${Highcharts.numberFormat(this.percentage, 1)}%)`;
                            },
                            style: {
                                fontSize: '14px',
                            },
                            connectorWidth: 2,
                        },
                        point: {
                            events: {
                                // Event handler for when a segment is hovered over
                                mouseOver: function() {
                                    var chart = this.series.chart;
                                    if (chart.lbl) {
                                        // Format the value and percentage with spaces
                                        var formattedValue = Highcharts.numberFormat(this.y, 0);
                                        var formattedPercentage = Highcharts.numberFormat(this.percentage, 1);
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
                                    var formattedTotal = Highcharts.numberFormat(total, 0);
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
                },
                responsive: {
                    rules: [
                        {
                            condition: {
                                maxWidth: 700, // For smaller screens
                            },
                            chartOptions: {
                                plotOptions: {
                                    pie: {
                                        dataLabels: {
                                            enabled: false, // Disable labels to avoid crowding
                                        },
                                    },
                                },
                                tooltip: {
                                    formatter: function () {
                                        return `<span style="color:${this.point.color}">\u25CF</span> ${this.point.name}: <b>${Highcharts.numberFormat(this.y, 0)}</b>`;
                                    },
                                },
                            },
                        },
                    ],
                },
            }
        }, {
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
                        text: 'Stunde'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Stundenverkehr'
                    }
                },
                series: [],
                tooltip: {
                    headerFormat: '<em>Stunde: {point.key}</em><br/>',
                    pointFormat:
                        '<span style="color:{series.color}">{series.name}</span><br/>' +
                        'Minimum: {point.low}<br/>' +
                        '25%-Quantil: {point.q1}<br/>' +
                        'Median: {point.median}<br/>' +
                        '75%-Quantil: {point.q3}<br/>' +
                        'Maximum: {point.high}<br/>'
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
                },
                responsive: {
                    rules: [{
                        condition: {
                            maxWidth: 768
                        },
                        chartOptions: {
                            series: [
                                {
                                    id: 'series-ri1',
                                    visible: false,
                                },
                                {
                                    id: 'series-ri2',
                                    visible: false,
                                },
                                {
                                    id: 'series-gesamt',
                                    visible: true,
                                }
                            ]
                        }
                    }]
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
        true,
        true
    );
}