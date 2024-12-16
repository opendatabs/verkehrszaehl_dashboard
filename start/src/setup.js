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

    // Initialize board with most basic data
    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
                ...getCommonConnectors(),
            {
                id: 'Yearly Traffic',
                type: 'JSON'
            }, {
                id: 'Daily Traffic',
                type: 'JSON'
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
                    buttonOptions: {
                        alignTo: 'spacingBox'
                    }
                },
                mapView: {
                    zoom: 13,
                    center: [7.62, 47.56]
                },
                series: [{
                    type: 'tiledwebmap',
                    name: 'Basemap Tiles',
                    provider: {
                        type: 'Esri',
                        theme: 'WorldGrayCanvas',
                    },
                    showInLegend: false
                }],
                credits: {
                    enabled: true,
                    text: 'Datenquelle: Standorte der Zählstellen für Verkehrszähldaten',
                    href: 'https://data.bs.ch/explore/dataset/100038/table/?disjunctive.name&disjunctive.gemeinde&disjunctive.klasse&disjunctive.kombiniert&disjunctive.art&disjunctive.arme&disjunctive.fahrstreif&disjunctive.zweck&disjunctive.typ&disjunctive.strtyp&disjunctive.eigentum&disjunctive.betriebzus&refine.klasse=Dauerzaehlstelle&refine.eigentum=Kanton+Basel-Stadt&refine.eigentum=Kanton+Basel-Sadt'
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
            cell: 'yearly-chart',
            type: 'Highcharts',
            connector: {
                id: 'Yearly Traffic',
                columnAssignment: [] // set dynamically
            },
            sync: {
                highlight: true
            },
            chartOptions: {
                chart: {
                    type: 'line', // Main chart type is line
                    height: '450px'
                },
                tooltip: {
                    shared: true,
                    formatter: function () {
                        let tooltipText = `<b>${this.x}</b><br/>`;
                        this.points.forEach(point => {
                            if (point.series.name === 'Durchschnittstemperatur') {
                                tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: `;
                                tooltipText += `<b>${Highcharts.numberFormat(point.y, 1, '.', "'")} °C</b><br/>`;
                            } else {
                                tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: `;
                                tooltipText += `<b>${Highcharts.numberFormat(point.y, 0, '.', "'")} </b><br/>`;
                            }
                        });

                        return tooltipText;
                    }
                },
                title: {
                    text: 'Durchschnittlicher Tagesverkehr (DTV) nach Jahr'
                },
                xAxis: {
                    title: {
                        text: 'Jahr'
                    },
                    allowDecimals: false
                },
                yAxis: [
                    {
                        title: {
                            text: 'Durchschnittlicher Tagesverkehr (DTV)'
                        },
                        min: 0
                    },
                    {
                        // Secondary Y-axis for "Temperature"
                        opposite: true,
                        title: {
                            text: 'Temperatur (°C)'
                        },
                        min: 8,
                        max: 16,
                        showEmpty: false // Hide the secondary Y-axis if no data is available
                    }
                ],
                series: [], // Set dynamically
                credits: {
                    enabled: true
                },
                accessibility: {
                    description: 'A line chart showing the average daily traffic (DTV) for the selected counting station.',
                    point: {
                        valueDescriptionFormat: '{value} vehicles per day in average in year {xDescription}.'
                    }
                }
            }
        }, {
            cell: 'availability-chart',
                type: 'Highcharts',
                connector: {
                    id: 'Yearly Traffic',
                    columnAssignment: [] // set dynamically
                },
                sync: {
                    highlight: true
                },
                chartOptions: {
                    chart: {
                        type: 'column',
                        height: '250px'
                    },
                    tooltip: {
                        shared: true,
                        formatter: function () {
                            let tooltipText = `<b>${this.x}</b><br/>`;
                            this.points.forEach(point => {
                                tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: `;
                                tooltipText += `<b>${Highcharts.numberFormat(point.y, 0, '.', "'")} Tage</b><br/>`;
                            });
                            return tooltipText;
                        }
                    },
                    title: {
                        text: 'Anzahl gemessene Tage pro Jahr'
                    },
                    xAxis: {
                        title: {
                            text: 'Jahr'
                        }
                    },
                    yAxis: [
                        {
                            title: {
                                text: 'Anzahl gemessene Tage'
                            },
                            max: 400,
                            labels: {
                                enabled: false // Disable labels for this axis
                            }
                        }
                    ],
                    series: [], // set dynamically
                    credits: {
                        enabled: true
                    },
                    accessibility: {
                        description: 'A column chart showing the availability of traffic data for the selected counting station.',
                        point: {
                            valueDescriptionFormat: '{value} days measured in year {xDescription}.'
                        }
                    }
                }
            }, {
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
                                    false,
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
                yAxis: [
                    {
                        title: {
                            text: 'Anzahl'
                        },
                        min: 0
                    }
                ],
                tooltip: {
                    shared: true, // This allows multiple series to share the tooltip
                    formatter: function() {
                        const date = Highcharts.dateFormat('%A, %d.%m.%Y', this.x);
                        let tooltipText = `<b>${date}</b><br/>`;
                        this.points.forEach(point => {
                            tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: 
                            <b>${Highcharts.numberFormat(point.y, 0, '.', "'")}</b><br/>`;
                        });
                        return tooltipText;
                    }
                },
                series: [
                    {
                        name: 'Anzahl',
                        data: [],
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#6f6f6f',
                        connectNulls: false
                    },
                    {
                        name: '7-Tage gleitender Durchschnitt',
                        data: [],
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#333333',
                        connectNulls: false
                    }
                ],
                credits: {
                    enabled: true,
                },
                accessibility: {
                    description: 'A line chart showing the daily traffic for the selected counting station and the selected time range.',
                    point: {
                        valueDescriptionFormat: '{value} vehicles on {xDescription}.'
                    }
                }
            }
        },
        {
            cell: 'weather-chart',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'line',
                    height: '400px'
                },
                title: {
                    text: 'Wetterdaten'
                },
                xAxis: {
                    type: 'datetime',
                    title: {
                        text: 'Datum'
                    },
                    min: state.activeTimeRange[0],
                    max: state.activeTimeRange[1]
                },
                yAxis: [
                    {
                        title: {
                            text: 'Durchschnittliche Lufttemperatur (°C)'
                        }
                    },
                    {
                        title: {
                            text: 'Niederschlagssumme (mm)'
                        },
                        opposite: true,
                        min: 0
                    }
                ],
                tooltip: {
                    shared: true,
                    formatter: function () {
                        const date = Highcharts.dateFormat('%A, %d.%m.%Y', this.x);
                        let tooltipText = `<b>${date}</b><br/>`;
                        this.points.forEach(point => {
                            let unit = '';
                            if (point.series.name === 'Temperatur' || point.series.name === 'Temperaturbereich') {
                                unit = ' °C';
                            } else if (point.series.name === 'Niederschlag') {
                                unit = ' mm';
                            }
                            if (point.series.name === 'Temperaturbereich') {
                                tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: 
                                                <b>${Highcharts.numberFormat(point.point.low, 1, '.', "'")}${unit} - 
                                                ${Highcharts.numberFormat(point.point.high, 1, '.', "'")}${unit}</b><br/>`;
                                return tooltipText;
                            }
                            else {
                                tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: 
                                                <b>${Highcharts.numberFormat(point.y, 1, '.', "'")}${unit}</b><br/>`;
                            }
                        });
                        return tooltipText;
                    }
                },
                series: [
                    {
                        name: 'Niederschlag',
                        type: 'column',
                        data: [],
                        color: '#5badff',
                        yAxis: 1,
                        connectNulls: false
                    },
                    {
                        name: 'Temperaturbereich',
                        type: 'arearange', // Use 'arearange' for the temperature range
                        data: [],
                        color: '#ffaaaa',
                        fillOpacity: 0.2, // Semi-transparent fill
                        lineWidth: 0, // Optional: remove line for cleaner area
                        marker: {
                            enabled: false
                        },
                    },
                    {
                        name: 'Durchschnittstemperatur',
                        data: [],
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#8B2223',
                        connectNulls: false
                    }
                ],
                credits: {
                    enabled: true,
                    text: 'Datenquelle: Tägliche Klimadaten der NBCN-Station Basel-Binningen',
                    href: 'https://data.bs.ch/explore/dataset/100254/'
                },
                accessibility: {
                    description: 'A line chart showing the weather data for the selected counting station and the selected time range.',
                    point: {
                        valueDescriptionFormat: '{value} on {xDescription}.'
                    }
                }
            }
        }]
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