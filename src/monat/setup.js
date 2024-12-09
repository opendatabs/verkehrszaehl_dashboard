import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {getStateFromUrl, clearZeiteinheitSelection} from '../functions.js';
import {getCommonConnectors} from '../common_connectors.js';
import {getFilterComponent, getDayRangeButtonsComponent} from "../common_components.js";
import {setupEventListeners} from "../eventListeners.js";

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

    // Initialize board with most basic data
    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
                ...getCommonConnectors(),
            {
                id: 'Monthly Traffic',
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
                                        activeTimeRange,
                                        true
                                    );
                                }
                            }
                        }
                    }
                }
            },
            getDayRangeButtonsComponent(state.weekday),
        {
            renderTo: 'month-table',
            type: 'DataGrid',
            connector: {
                id: 'Monthly Traffic'
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
            }
        },{
            cell: 'monthly-dtv-chart',
            type: 'Highcharts',
            connector: {
                id: 'Monthly Traffic',
                columnAssignment: []
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
                    text: 'Durchschnittlicher Monatsverkehr (DTV)'
                },
                xAxis: {
                    categories: [
                        'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
                    ],
                    title: {
                        text: 'Monat'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Anz. Fzg./Tag'
                    }
                },
                tooltip: {
                    useHTML: true,
                    formatter: function () {
                        return `
                                    <b style="color:${this.series.color}">${this.series.name}</b><br>
                                    Monat: <b>${this.x}</b><br>
                                    Anzahl Fahrzeuge: <b>${Highcharts.numberFormat(this.y, 0)}</b>
                               `;
                    }
                },
                series: [],
                accessibility: {
                    description: 'A line chart showing the average monthly traffic (DMV) for the selected counting station.',
                    typeDescription: 'A line chart showing DMV trends over a range of years.'
                }
            }
        }, {
                cell: 'monthly-weather-chart',
                type: 'Highcharts',
                connector: {
                    id: 'Monthly Traffic',
                    columnAssignment: [
                        {
                            seriesId: 'temperatur-series',
                            data: 'monthly_temp'
                        },
                        {
                            seriesId: 'niederschlag-series',
                            data: 'monthly_precip'
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
                        text: 'Durchschnittliche Wetterdaten nach Monat'
                    },
                    xAxis: {
                        categories: [
                            'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
                        ],
                        title: {
                            text: 'Monat'
                        }
                    },
                    yAxis: [
                        {
                            title: {
                                text: 'Temperatur (°C)'
                            }
                        },
                        {
                            title: {
                                text: 'Niederschlag (mm)'
                            },
                            opposite: true,
                            min: 0
                        }
                    ],
                    tooltip: {
                        shared: true,
                        formatter: function() {
                            const date = Highcharts.dateFormat('%A, %b %e, %Y', this.x);
                            let tooltipText = `<b>${date}</b><br/>`;
                            this.points.forEach(point => {
                                let unit = '';
                                if (point.series.name === 'Temperatur') {
                                    unit = ' °C';
                                } else if (point.series.name === 'Niederschlag') {
                                    unit = ' mm';
                                }

                                tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: 
                    <b>${Highcharts.numberFormat(point.y, 1, ',', '.')}${unit}</b><br/>`;
                            });
                            return tooltipText;
                        }
                    },
                    series: [
                        {
                            id: 'temperatur-series',
                            name: 'Temperatur',
                            type: 'line',
                            marker: {
                                symbol: 'circle',
                                enabled: false
                            },
                            color: '#8B2223',
                            yAxis: 0,
                            tooltip: {
                                valueSuffix: ' °C'
                            }
                        },
                        {
                            id: 'niederschlag-series',
                            name: 'Niederschlag',
                            type: 'line',
                            marker: {
                                symbol: 'circle',
                                enabled: false
                            },
                            color: '#5badff',
                            yAxis: 1,
                            tooltip: {
                                valueSuffix: ' mm'
                            }
                        }
                    ]
                }
            }, {
            cell: 'monthly-box-plot',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'boxplot',
                    height: '400px'
                },
                title: {
                    text: 'Verteilung von Tagesverkehr nach Monat'
                },
                xAxis: {
                    categories: [
                        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
                    ],
                    title: {
                        text: 'Monat'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Anzahl Fahrzeuge pro Tag'
                    }
                },
                series: [],
                tooltip: {
                    headerFormat: '<em>Monat: {point.key}</em><br/>',
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