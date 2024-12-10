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
                columns: []}
        }, {
            cell: 'weekly-dtv-chart',
            type: 'Highcharts',
            connector: {
                id: 'Weekly Traffic',
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
                    text: 'Durchschnittlicher Wochenverkehr (DTV)'
                },
                xAxis: {
                    categories: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], // Weekday categories
                    title: {
                        text: 'Wochentag'
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
                                Wochentag: <b>${this.x}</b><br>
                                Anzahl Fahrzeuge: <b>${Highcharts.numberFormat(this.y, 0)}</b>
                           `;
                    }
                },
                series: [],
                accessibility: {
                    description: 'A column chart showing the average weekly traffic for each weekday (Mo to So).',
                    typeDescription: 'A column chart showing weekly traffic.'
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
                        text: 'Verteilung von Tagesverkehr nach Wochentag'
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
                            text: 'Anzahl Fahrzeuge pro Tag'
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