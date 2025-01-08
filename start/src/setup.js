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
                    margin: 0,
                    height: '700px'
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
                columnAssignment: [
                    {
                        seriesId: 'series-ri1',
                        data: ['year', 'dtv_ri1']
                    },
                    {
                        seriesId: 'series-ri2',
                        data: ['year', 'dtv_ri2']
                    },
                    {
                        seriesId: 'series-gesamt',
                        data: ['year', 'dtv_total']
                    },
                    {
                        seriesId: 'series-temp',
                        data: ['year', 'temp']
                    }
                ]
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
                    formatter: function () {
                        const chart = this.series.chart;
                        const categoryIndex = this.point.index;
                        const category = this.x;
                        let tooltipText = `<b>${category}</b><br/>`;

                        chart.series.forEach(s => {
                            const point = s.points[categoryIndex];
                            if (point && point.y !== null && point.y !== undefined) {
                                const fontWeight = (s === this.series) ? 'bold' : 'normal';

                                tooltipText += `<span style="color:${s.color}">\u25CF</span> `;
                                tooltipText += `<span style="font-weight:${fontWeight}">${s.name}</span>: `;

                                if (s.name === 'Durchschnittstemperatur') {
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 1, '.', "'")} °C</span><br/>`;
                                } else {
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 0, '.', "'")}</span><br/>`;
                                }
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
                series: [
                    {
                        id: 'series-ri1',
                        name: 'Richtung 1',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#007a2f'
                    },
                    {
                        id: 'series-ri2',
                        name: 'Richtung 2',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#008ac3'
                    },
                    {
                        id: 'series-gesamt',
                        name: 'Gesamtquerschnitt',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#6f6f6f'
                    },
                    {
                        id: 'series-temp',
                        name: 'Durchschnittstemperatur',
                        dashStyle: 'Dash',
                        yAxis: 1,
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#8B2223'
                    }
                ],
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
                    columnAssignment: [
                        {
                            seriesId: 'avail-ri1',
                            data: ['year', 'avail_ri1']
                        },
                        {
                            seriesId: 'avail-ri2',
                            data: ['year', 'avail_ri2']
                        },
                        {
                            seriesId: 'avail-gesamt',
                            data: ['year', 'avail_total']
                        }
                    ]
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
                        formatter: function () {
                            const chart = this.series.chart;
                            const categoryIndex = this.point.index;
                            const category = this.x;
                            let tooltipText = `<b>${category}</b><br/>`;

                            chart.series.forEach(s => {
                                const point = s.points[categoryIndex];
                                if (point && point.y !== null && point.y !== undefined) {
                                    const fontWeight = (s === this.series) ? 'bold' : 'normal';

                                    tooltipText += `<span style="color:${s.color}">\u25CF</span> `;
                                    tooltipText += `<span style="font-weight:${fontWeight}">${s.name}</span>: `;
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 0, '.', "'")} Tage</span><br/>`;
                                }
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
                    series: [
                        {
                            id: 'avail-ri1',
                            name: 'Richtung 1',
                            color: '#007a2f'
                        },
                        {
                            id: 'avail-ri2',
                            name: 'Richtung 2',
                            color: '#008ac3'
                        },
                        {
                            id: 'avail-gesamt',
                            name: 'Gesamtquerschnitt',
                            color: '#6f6f6f'
                        },
                    ],
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
                                }, 300);
                            };
                        })()
                    }
                }
            }
        },
            getDayRangeButtonsComponent(state.weekday, 1, false),
        {
            cell: 'tv-chart',
            type: 'Highcharts',
            connector: {
                id: 'Daily Traffic',
                columnAssignment: [
                    {
                        seriesId: 'series-gesamt',
                        data: ['tag', 'tv_gesamt']
                    },
                    {
                        seriesId: 'series-rolling',
                        data: ['tag', 'tv_rolling']
                    }
                ]
            },
            sync: {
                highlight: true
            },
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
                    formatter: function () {
                        const chart = this.series.chart;
                        const hoveredX = this.x;
                        const date = Highcharts.dateFormat('%A, %d.%m.%Y', hoveredX);

                        let tooltipText = `<b>${date}</b><br/>`;

                        chart.series.forEach(s => {
                            const point = s.points.find(p => p.x === hoveredX);

                            if (point && point.y !== null && point.y !== undefined) {
                                const fontWeight = (s === this.series) ? 'bold' : 'normal';

                                let unit = '';
                                if (s.name === 'Temperatur' || s.name === 'Temperaturbereich') {
                                    unit = ' °C';
                                } else if (s.name === 'Niederschlag') {
                                    unit = ' mm';
                                }

                                tooltipText += `<span style="color:${s.color}">\u25CF</span> `;
                                tooltipText += `<span style="font-weight:${fontWeight}">${s.name}</span>: `;

                                if (s.name === 'Temperaturbereich' && point.low !== undefined && point.high !== undefined) {
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.low, 1, '.', "'")}${unit} - `;
                                    tooltipText += `${Highcharts.numberFormat(point.high, 1, '.', "'")}${unit}</span><br/>`;
                                } else {
                                    const decimals = (s.name === 'Temperatur' || s.name === 'Temperaturbereich') ? 1 : 0;
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, decimals, '.', "'")}${unit}</span><br/>`;
                                }
                            }
                        });
                        return tooltipText;
                    }
                },
                series: [
                    {
                        id: 'series-gesamt',
                        name: 'Anzahl',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#6f6f6f',
                        connectNulls: false
                    },
                    {
                        id: 'series-rolling',
                        name: '7-Tage gleitender Durchschnitt',
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
            connector: {
                id: 'Daily Traffic',
                columnAssignment: [
                    {
                        seriesId: 'series-temp',
                        data: ['tag', 'temperatur']
                    },
                    {
                        seriesId: 'series-prec',
                        data: ['tag', 'niederschlag']
                    },
                    {
                        seriesId: 'series-temp-range',
                        data: ['tag', 'temperatur_min', 'temperatur_max']
                    }
                ]
            },
            sync: {
                highlight: true
            },
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
                    formatter: function () {
                        const chart = this.series.chart;
                        const categoryIndex = this.point.index;
                        const date = Highcharts.dateFormat('%A, %d.%m.%Y', this.x);
                        let tooltipText = `<b>${date}</b><br/>`;

                        chart.series.forEach(s => {
                            const point = s.points[categoryIndex];
                            if (point && point.y !== null && point.y !== undefined) {
                                let unit = '';
                                if (s.name === 'Temperatur' || s.name === 'Temperaturbereich') {
                                    unit = ' °C';
                                } else if (s.name === 'Niederschlag') {
                                    unit = ' mm';
                                }

                                const fontWeight = (s === this.series) ? 'bold' : 'normal';

                                tooltipText += `<span style="color:${s.color}">\u25CF</span> `;
                                tooltipText += `<span style="font-weight:${fontWeight}">${s.name}</span>: `;

                                if (s.name === 'Temperaturbereich') {
                                    // For range series (high/low)
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.low, 1, '.', "'")}${unit} - `;
                                    tooltipText += `${Highcharts.numberFormat(point.high, 1, '.', "'")}${unit}</span><br/>`;
                                } else {
                                    // Normal single value
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 1, '.', "'")}${unit}</span><br/>`;
                                }
                            }
                        });
                        return tooltipText;
                    }
                },
                series: [
                    {
                        id: 'series-prec',
                        name: 'Niederschlag',
                        type: 'column',
                        color: '#5badff',
                        yAxis: 1,
                        connectNulls: false
                    },
                    {
                        id: 'series-temp-range',
                        name: 'Temperaturbereich',
                        type: 'arearange',
                        color: '#ffaaaa',
                        fillOpacity: 0.2, // Semi-transparent fill
                        lineWidth: 0,
                        marker: {
                            enabled: false
                        },
                    },
                    {
                        id: 'series-temp',
                        name: 'Durchschnittstemperatur',
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