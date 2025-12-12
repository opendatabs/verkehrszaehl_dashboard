import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {getStateFromUrl} from '../../src/functions.js';
import {
    getFilterComponent,
    getFzgtypFilterSectionComponent,
    getDayRangeButtonsComponent
} from "../../src/common_components.js";
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

    // --- dummy data so components have something to bind to ---
    const dummyYearly = [
        // keep a couple of years; values can be null
        { year: 2022, dtv_ri1: null, dtv_ri2: null, dtv_total: null, temp: null, avail_ri1: 0, avail_ri2: 0, avail_total: 0 },
        { year: 2023, dtv_ri1: null, dtv_ri2: null, dtv_total: null, temp: null, avail_ri1: 0, avail_ri2: 0, avail_total: 0 }
    ];

    const makeDaily = ts => ({
        tag: ts,                   // unix ms timestamp; matches your columnAssignment
        tv_gesamt: null,
        tv_rolling: null,
        temperatur: null,
        niederschlag: null,
        temperatur_min: null,
        temperatur_max: null
    });

// ensure at least two x points spanning the initial range
    const dummyDaily = [
        makeDaily(state.activeTimeRange[0]),
        makeDaily(state.activeTimeRange[1])
    ];

    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
            {
                id: 'Yearly Traffic',
                type: 'JSON',
                data: dummyYearly
            },
            {
                id: 'Daily Traffic',
                type: 'JSON',
                data: dummyDaily
            }]
        },
        gui,
        components: [
            getFilterComponent(),
            getFzgtypFilterSectionComponent(),
        {
            renderTo: 'map',
            type: 'Highcharts',
            chartConstructor: 'mapChart',
            chartOptions: {
                chart: {
                    margin: 0,
                    height: '700px'
                },
                legend: {
                    className: 'map-legend-box'
                },
                mapNavigation: {
                    enabled: true,
                    buttonOptions: {
                        alignTo: 'spacingBox'
                    }
                },
                mapView: {
                    projection: {
                        name: 'WebMercator'
                    },
                    maxZoom: 20,
                },
                series: [{
                    type: 'tiledwebmap',
                    provider: {
                        url: 'https://wmts.geo.bs.ch/wmts/1.0.0/BaseMap_grau/default/3857/{z}/{y}/{x}.png',
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
                    useHTML: true,
                    borderRadius: 8,
                    padding: 10,
                    style: {
                        fontSize: '14px',
                        lineHeight: '1.4'
                    },
                    stickOnContact: true,
                    distance: -60,
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
            renderTo: 'yearly-chart',
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
                    useHTML: true,
                    borderRadius: 8,
                    padding: 10,
                    style: {
                        fontSize: '14px',
                        lineHeight: '1.4'
                    },
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
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 1)} °C</span><br/>`;
                                } else {
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 0)}</span><br/>`;
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
                        opacity: 0.4,
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        },
                        color: '#1e4557'
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
            renderTo: 'availability-chart',
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
                    useHTML: true,
                    borderRadius: 8,
                    padding: 10,
                    style: {
                        fontSize: '14px',
                        lineHeight: '1.4'
                    },
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
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 0)} Tage</span><br/>`;
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
            renderTo: 'time-range-selector',
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
            getDayRangeButtonsComponent(state.weekday, 1, false),
        {
            renderTo: 'tv-chart',
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
                    useHTML: true,
                    borderRadius: 8,
                    padding: 10,
                    style: {
                        fontSize: '14px',
                        lineHeight: '1.4'
                    },
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
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.low, 1)}${unit} - `;
                                    tooltipText += `${Highcharts.numberFormat(point.high, 1)}${unit}</span><br/>`;
                                } else {
                                    const decimals = (s.name === 'Temperatur' || s.name === 'Temperaturbereich') ? 1 : 0;
                                    tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, decimals)}${unit}</span><br/>`;
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
            renderTo: 'weather-chart',
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
                    useHTML: true,
                    borderRadius: 8,
                    padding: 10,
                    style: {
                        fontSize: '14px',
                        lineHeight: '1.4'
                    },
                    formatter: function () {
                        const chart = this.series.chart;
                        const x = this.x;
                        const date = Highcharts.dateFormat('%A, %d.%m.%Y', x);
                        let html = `<b>${date}</b><br/>`;

                        chart.series.forEach(s => {
                            const pt = s.points?.find(p => p && p.x === x);
                            if (!pt) return;

                            const bold = (s === this.series) ? 'bold' : 'normal';
                            let unit = '';
                            if (s.name === 'Temperatur' || s.name === 'Temperaturbereich' || s.name === 'Durchschnittstemperatur') {
                                unit = ' °C';
                            } else if (s.name === 'Niederschlag') {
                                unit = ' mm';
                            }

                            html += `<span style="color:${s.color}">\u25CF</span> `;
                            html += `<span style="font-weight:${bold}">${s.name}</span>: `;

                            if (s.name === 'Temperaturbereich' && pt.low !== undefined && pt.high !== undefined) {
                                html += `<span style="font-weight:${bold}">${Highcharts.numberFormat(pt.low, 1)}${unit} – `;
                                html += `${Highcharts.numberFormat(pt.high, 1)}${unit}</span><br/>`;
                            } else {
                                const decimals = unit.trim() === '°C' ? 1 : 1;
                                html += `<span style="font-weight:${bold}">${Highcharts.numberFormat(pt.y, decimals)}${unit}</span><br/>`;
                            }
                        });

                        return html;
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