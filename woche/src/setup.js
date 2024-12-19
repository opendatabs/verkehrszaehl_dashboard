import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {getStateFromUrl, clearZeiteinheitSelection} from '../../src/functions.js';
import {getCommonConnectors} from '../../src/common_connectors.js';
import {getFilterComponent, getDayRangeButtonsComponent} from "../../src/common_components.js";
import {setupEventListeners} from "../../src/eventListeners.js";


export default async function setupBoard() {
    const initialState = getStateFromUrl();

    const state = {
        activeTimeRange: initialState.activeTimeRange,
        activeStrtyp: initialState.activeStrtyp,
        activeType: initialState.activeType,
        activeFzgtyp: initialState.activeFzgtyp,
        activeZst: initialState.activeZst,
        weekday: initialState.weekday
    };

    const smallestZeiteinheit = 7;

    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
                ...getCommonConnectors(),
            {
                id: 'Weekly Traffic',
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
                    type: 'column'
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
                    minRange: smallestZeiteinheit * 24 * 3600 * 1000, // 1 week
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
            getDayRangeButtonsComponent(state.weekday, smallestZeiteinheit),
        {
            renderTo: 'weekly-table',
            type: 'DataGrid',
            connector: {
                id: 'Weekly Traffic'
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
            cell: 'weekly-dtv-chart',
            type: 'Highcharts',
            connector: {
                id: 'Weekly Traffic',
                columnAssignment: [
                    {
                        seriesId: `series-ri1`,
                        data: `dtv_ri1`
                    },
                    {
                        seriesId: `series-ri2`,
                        data: `dtv_ri2`
                    },
                    {
                        seriesId: 'series-gesamt',
                        data: 'dtv_total'
                    },
                    {
                        seriesId: 'series-durchschnitt',
                        data: 'average_dtv_total'
                    }
                ]
            },
            sync: {
                highlight: true
            },
            chartOptions: {
                chart: {
                    type: 'column',
                    height: '400px'
                },
                title: {
                    text: 'Durchschnittlicher Tagesverkehr (DTV) nach Wochentag'
                },
                xAxis: {
                    categories: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], // Weekday categories
                    title: {
                        text: 'Wochentag'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Durchschnittlicher Tagesverkehr (DTV)'
                    }
                },
                tooltip: {
                    shared: true, // Enables multiple series to share the tooltip
                    formatter: function () {
                        // Access the categories array from xAxis
                        const categories = this.series.chart.options.xAxis[0].categories;
                        // Get the category for the current x value
                        const category = categories[this.points[0].point.x];
                        let tooltipText = `<b>${category}</b><br/>`;
                        this.points.forEach(point => {
                            tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: `;
                            tooltipText += `<b>${Highcharts.numberFormat(point.y, 0, '.', "'")}</b><br/>`;
                        });

                        return tooltipText;
                    }
                },
                series: [
                    {
                        id: `series-ri1`,
                        name: 'Richtung 1',
                        color: '#007a2f'
                    },
                    {
                        id: `series-ri2`,
                        name: 'Richtung 2',
                        color: '#008ac3'
                    },
                    {
                        id: 'series-gesamt',
                        name: 'Gesamtquerschnitt',
                        color: '#6f6f6f'
                    },
                    {
                        id: 'series-durchschnitt',
                        type: 'line',
                        name: 'Durchschnitt',
                        marker: {
                            enabled: false
                        },
                        color: '#333333',
                        dashStyle: 'Dash',
                        zIndex: 0,
                    }
                ],
                credits: {
                    enabled: true
                },
                accessibility: {
                    description: 'A column chart showing the average daily traffic for each weekday (Mo to So).',
                    point: {
                        valueDescriptionFormat: 'Weekday: {xDescription}, Average Daily Traffic: {value}'
                    }
                }
            }
        }, {
                cell: 'weekly-box-plot',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'boxplot',
                        height: '400px'
                    },
                    title: {
                        text: 'Verteilung des Tagesverkehrs nach Wochentag'
                    },
                    xAxis: {
                        categories: [
                            'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'
                        ],
                        title: {
                            text: 'Wochentag'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anzahl'
                        }
                    },
                    series: [],
                    tooltip: {
                        headerFormat: '<em>Wochentag: {point.key}</em><br/>',
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
                        description: 'A box plot showing the distribution of daily traffic for each weekday (Mo to So).',
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
        true,
        true
    );
}