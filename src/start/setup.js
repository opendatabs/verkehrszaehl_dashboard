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
        activeType: initialState.activeType,
        activeCountingStation: initialState.activeCountingStation,
        weekday: initialState.weekday
    };

    // Initialize board with most basic data
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
            cell: 'map',
            type: 'Highcharts',
            chartConstructor: 'mapChart',
            chartOptions: {
                chart: {
                    margin: 0
                },
                legend: {
                    enabled: false
                },
                mapNavigation: {
                    enabled: true,
                    enableDoubleClickZoomTo: true,
                    buttonOptions: {
                        alignTo: 'spacingBox'
                    }
                },
                mapView: {
                    projection: {
                        name: 'WebMercator'
                    },
                    zoom: 12,
                    center: [7.589804, 47.560058]
                },
                series: [{
                    type: 'tiledwebmap',
                    provider: {
                        url: 'https://wmts.geo.bs.ch/wmts/1.0.0/BaseMap_grau/default/3857/{z}/{y}/{x}.png'
                    },
                    showInLegend: false
                }],
                credits: {
                    enabled: true,
                    text: 'Geoportal Kanton Basel-Stadt',
                    href: 'https://www.geo.bs.ch/'
                },
                title: {
                    text: void 0
                },
                tooltip: {
                    shape: 'rect',
                    distance: -60,
                    useHTML: true,
                    stickOnContact: true
                },
                lang: {
                    accessibility: {
                        chartContainerLabel: 'Counting stations in Basel. Highcharts Interactive Map.'
                    }
                },
                accessibility: {
                    description: `The chart is displaying counting stations in Basel.`,
                    point: {
                        valueDescriptionFormat: '{index}. {point.name}, {point.lat}, {point.lon}.'
                    }
                }
            }
        }, {
                cell: 'dtv-chart',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'line', // Main chart type is line
                        height: '400px'
                    },
                    tooltip: {
                        useHTML: true,
                        formatter: function () {
                            if (this.series.name === 'Verfügbarkeit') {
                                return `
                        <b style="color:${this.series.color}">${this.series.name}</b><br>
                        Jahr: <b>${Highcharts.dateFormat('%Y', this.x)}</b><br>
                        Anzahl gemessene Tage: <b>${Highcharts.numberFormat(this.y, 0)}</b>
                    `;
                            }
                            // Default tooltip for other series
                            return `
                    <b style="color:${this.series.color}">${this.series.name}</b><br>
                    Jahr: <b>${Highcharts.dateFormat('%Y', this.x)}</b><br>
                    Anzahl Fahrzeuge pro Tag: <b>${Highcharts.numberFormat(this.y, 0)}</b>
                `;
                        },
                    },
                    title: {
                        text: 'Durchschnittlicher Tagesverkehr (DTV)'
                    },
                    xAxis: {
                        type: 'datetime',
                        title: {
                            text: 'Jahr'
                        }
                    },
                    yAxis: [
                        {
                            // Primary Y-axis for "Anz. Fzg."
                            title: {
                                text: 'Anz. Fzg. por Tag'
                            },
                            min: 0
                        },
                        {
                            // Secondary Y-axis for "Verfügbarkeit"
                            title: {
                                text: 'Anzahl gemessene Tage'
                            },
                            opposite: true, // Place on the opposite side of the chart
                            max: 2000,
                            labels: {
                                enabled: false // Disable labels for this axis
                            }
                        }
                    ],
                    series: [
                        {
                            name: 'Gesamtquerschnitt',
                            data: [],
                            marker: {
                                enabled: false
                            }
                        },
                        {
                            name: 'Verfügbarkeit',
                            type: 'column',
                            data: [],
                            marker: {
                                enabled: false,
                            },
                            yAxis: 1 // Link this series to the secondary Y-axis
                        }
                    ],
                    accessibility: {
                        description: 'A line chart showing the average daily traffic (DTV) for the selected counting station.',
                        typeDescription: 'A line chart showing DTV trends over a range of years.'
                    }
                }
            },{
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
                                    newState.activeCountingStation,
                                    true,
                                    newState.activeType,
                                    activeTimeRange
                                );
                            }
                        }
                    }
                }
            }
        },
            getDayRangeButtonsComponent(state.weekday),
        {
            cell: 'tv-chart',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'line',
                    height: '400px'
                },
                title: {
                    text: 'Tagesverkehr'
                },
                xAxis: {
                    type: 'datetime',
                    title: {
                        text: 'Datum'
                    },
                    min: state.activeTimeRange[0],
                    max: state.activeTimeRange[1]
                },
                yAxis: {
                    title: {
                        text: 'Anzahl Fahrzeuge'
                    }
                },
                tooltip: {
                    shared: true, // This allows multiple series to share the tooltip
                    formatter: function() {
                        const date = Highcharts.dateFormat('%A, %b %e, %Y', this.x);
                        let tooltipText = `<b>${date}</b><br/>`;
                        this.points.forEach(point => {
                            tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: <b>${Highcharts.numberFormat(point.y, 0, ',', '.')}</b><br/>`;
                        });
                        return tooltipText;
                    }
                },
                series: [
                    {
                        name: 'Anzahl Fahrzeuge',
                        data: [],
                        marker: {
                            enabled: false
                        },
                        connectNulls: false
                    },
                    {
                        name: '7-Tage gleitender Durchschnitt',
                        data: [],
                        marker: {
                            enabled: false
                        },
                        connectNulls: false
                    }
                ]
            }
        }]
    }, true);

    setupEventListeners(updateBoard, board);

    // Load active counting station
    await updateBoard(board,
        state.activeCountingStation,
        true,
        state.activeType,
        state.activeTimeRange);
}