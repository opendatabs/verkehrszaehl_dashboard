import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {getStateFromUrl} from '../../src/functions.js';
import {
    getFilterComponent,
    getFzgtypFilterSectionComponent,
    getSpeedFilterSectionComponent,
    getDayRangeButtonsComponent,
    getBoxScatterToggleComponent
} from "../../src/common_components.js";
import {setupEventListeners} from "../../src/eventListeners.js";

export default async function setupBoard() {
    Highcharts.setOptions({
       lang: {
           locale: 'de-CH',
          decimalPoint: '.',
          thousandsSep: "'",
       },
       chart: {
           backgroundColor: '#ffffff'
       },
       plotOptions: {
           series: {
               animation: false
           }
       }
    });

    const initialState = getStateFromUrl();

    const state = {
        activeTimeRange: initialState.activeTimeRange,
        activeStrtyp: initialState.activeStrtyp,
        activeType: initialState.activeType,
        activeFzgtyp: initialState.activeFzgtyp,
        activeSpeed: initialState.activeSpeed,
        activeZst: initialState.activeZst,
        weekday: initialState.weekday
    };

    const smallestZeiteinheitInDays = 365;
    const smallestZeiteinheitInMs = smallestZeiteinheitInDays * 24 * 3600 * 1000;

    if (state.activeTimeRange[1] - state.activeTimeRange[0] < smallestZeiteinheitInMs) {
        state.activeTimeRange[0] = state.activeTimeRange[1] - smallestZeiteinheitInMs;
    }

    // --- dummy data to avoid empty-connector errors ---
    const monthKeys = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

    const dummyMonthly = monthKeys.map((m, i) => ({
        month: m,
        month_index: i,
        // traffic
        dtv_ri1: 0,
        dtv_ri2: 0,
        dtv_total: 0,
        average_dtv_total: 0,
        // weather (arearange expects [low, high])
        monthly_temp_range: [null, null],
        monthly_temp: null,
        monthly_precip: 0
    }));

    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
            {
                id: 'Monthly Traffic',
                type: 'JSON',
                data: dummyMonthly,
                dataModifier: {
                    'type': 'Math',
                }
            }]
        },
        gui,
        components: [
            getFilterComponent(),
            getFzgtypFilterSectionComponent(),
            getSpeedFilterSectionComponent(),
            getDayRangeButtonsComponent(state.weekday, smallestZeiteinheitInDays),
        {
            renderTo: 'time-range-selector',
            type: 'Navigator',
            chartOptions: {
                chart: {
                    height: '100px',
                    type: 'column'
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
                    minRange: smallestZeiteinheitInMs, // 1 year
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
                                            currentState.activeSpeed,
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
        {
            renderTo: 'month-table',
            type: 'Grid',
            connector: {
                id: 'Monthly Traffic'
            },
            sync: {
                highlight: {
                    enabled: true,
                    autoScroll: true
                }
            },
            gridOptions: {
                editable: false,
                header: [],
                columns: [],
                credits: {
                    enabled: true,
                    text: 'Datenquelle: Verkehrszähldaten motorisierter Individualverkehr',
                    href: 'https://data.bs.ch/explore/dataset/100006/'
                },
                rendering: {
                    theme: 'hcg-theme-default bs-grid-theme'
                }
            }
        },{
            renderTo: 'monthly-dtv-chart',
            type: 'Highcharts',
            connector: {
                id: 'Monthly Traffic',
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
                    text: 'Durchschnittlicher Tagesverkehr (DTV) nach Monat'
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
                        text: 'Durchsnittlicher Tagesverkehr (DTV)'
                    }
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
                        const categoryIndex = this.point.x;
                        const categories = chart.options.xAxis[0].categories;
                        const category = categories[categoryIndex];

                        let tooltipText = `<b>${category}</b><br/>`;

                        chart.series.forEach(s => {
                            const point = s.points[categoryIndex];
                            if (point && point.y !== null && point.y !== undefined) {
                                const fontWeight = (s === this.series) ? 'bold' : 'normal';
                                tooltipText += `<span style="color:${s.color}">\u25CF</span> `;
                                tooltipText += `<span style="font-weight:${fontWeight}">${s.name}</span>: `;
                                tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 0)}</span><br/>`;
                            }
                        });

                        return tooltipText;
                    }
                },
                series: [
                    {
                        id: `series-ri1`,
                        name: 'Rictung 1',
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
                        name: 'Durchschnitt',
                        type: 'line',
                        dashStyle: 'Dash',
                        zIndex: 0,
                        marker: {
                            enabled: false
                        },
                        color: '#333333'
                    }
                ],
                credits: {
                    enabled: true,
                    text: 'Datenquelle: Verkehrszähldaten motorisierter Individualverkehr',
                    href: 'https://data.bs.ch/explore/dataset/100006/'
                },
                accessibility: {
                    description: 'A column chart showing the average daily traffic for each month.',
                    point: {
                        valueDescriptionFormat: 'Month: {xDescription}, Average Daily Traffic: {value}'
                    }
                }
            }
        }, {
                renderTo: 'monthly-weather-chart',
                type: 'Highcharts',
                connector: {
                    id: 'Monthly Traffic',
                    columnAssignment: [
                        {
                            seriesId: 'temperatur-range-series',
                            data: 'monthly_temp_range'
                        },
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
                            const categoryIndex = this.point.x;
                            const categories = chart.options.xAxis[0].categories;
                            const category = categories[categoryIndex];

                            let tooltipText = `<b>${category}</b><br/>`;

                            chart.series.forEach(s => {
                                const point = s.points[categoryIndex];
                                if (point && point.y !== null && point.y !== undefined) {
                                    const fontWeight = (s === this.series) ? 'bold' : 'normal';

                                    tooltipText += `<span style="color:${s.color}">\u25CF</span> `;
                                    tooltipText += `<span style="font-weight:${fontWeight}">${s.name}</span>: `;

                                    if (s.name === 'Temperaturbereich' && point.low !== undefined && point.high !== undefined) {
                                        // For range series
                                        tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.low, 1)} °C - `;
                                        tooltipText += `${Highcharts.numberFormat(point.high, 1)} °C</span><br/>`;
                                    } else {
                                        // Determine unit
                                        let unit = s.name === 'Niederschlag' ? ' mm' : ' °C';
                                        tooltipText += `<span style="font-weight:${fontWeight}">${Highcharts.numberFormat(point.y, 1)}${unit}</span><br/>`;
                                    }
                                }
                            });

                            return tooltipText;
                        }
                    },
                    series: [
                        {
                            id: 'niederschlag-series',
                            name: 'Niederschlag',
                            type: 'column',
                            marker: {
                                symbol: 'circle',
                                enabled: false
                            },
                            color: '#5badff',
                            yAxis: 1,
                            tooltip: {
                                valueSuffix: ' mm'
                            }
                        },
                        {
                            id: 'temperatur-range-series',
                            name: 'Temperaturbereich',
                            type: 'arearange',
                            data: [],
                            color: '#ffaaaa',
                            fillOpacity: 0.2,
                            lineWidth: 0,
                            marker: {
                                enabled: false
                            }
                        },
                        {
                            id: 'temperatur-series',
                            name: 'Durchschnittstemperatur',
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
                        }
                    ],
                    credits: {
                        enabled: true,
                        text: 'Datenquelle: Tägliche Klimadaten der NBCN-Station Basel-Binningen',
                        href: 'https://data.bs.ch/explore/dataset/100254/'
                    },
                    accessibility: {
                        description: 'A column chart showing the average temperature and precipitation for each month.',
                        point: {
                            valueDescriptionFormat: '{point.name}: {point.y}'
                        }
                    }
                }
            },
            getBoxScatterToggleComponent('monthly'),
            {
            renderTo: 'monthly-box-plot',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'boxplot',
                    height: '400px'
                },
                title: {
                    text: 'Verteilung des Tagesverkehrs nach Monat'
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
                        text: 'Tagesverkehr'
                    }
                },
                series: [],
                tooltip: {
                    useHTML: true,
                    borderRadius: 8,
                    padding: 10,
                    style: {
                        fontSize: '14px',
                        lineHeight: '1.4'
                    },
                    headerFormat: '<em>Monat: <b>{point.key}</b></em><br/>',
                    pointFormat:
                        '<span style="color:{series.color}"><b>{series.name}</b></span><br/>' +
                        'Maximum: <b>{point.high}</b><br/>' +
                        '75%-Quantil: <b>{point.q3}</b><br/>' +
                        'Median: <b>{point.median}</b><br/>' +
                        '25%-Quantil: <b>{point.q1}</b><br/>' +
                        'Minimum: <b>{point.low}</b><br/>'
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
                    enabled: true,
                    text: 'Datenquelle: Verkehrszähldaten motorisierter Individualverkehr',
                    href: 'https://data.bs.ch/explore/dataset/100006/'
                },
                accessibility: {
                    description: 'A box plot showing the distribution of daily traffic for each  month.',
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
        },
        {
            renderTo: 'monthly-scatter-plot',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'scatter',
                    height: '400px'
                },
                title: {
                    text: 'Einzelmessungen Tagesverkehr nach Monat'
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
                        text: 'Tagesverkehr (Einzelmessungen)'
                    }
                },
                plotOptions: {
                    scatter: {
                        jitter: {
                            x: 0.08, // small jitter, side-by-side comes from our manual offsets
                            y: 0
                        },
                        marker: {
                            radius: 3,
                            symbol: 'circle'
                        }
                    }
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
                        const categories = chart.xAxis[0].categories;

                        const monthIndex = Math.round(this.x);
                        const monthLabel = categories[monthIndex] || monthIndex;

                        const dateMs = this.point.date;
                        const hasDate = typeof dateMs === 'number';

                        const dateLabel = hasDate
                            ? Highcharts.dateFormat('%A, %d.%m.%Y', dateMs)
                            : '';

                        let html = '';
                        if (dateLabel) {
                            html += `<div style="margin-bottom:4px;"><em>${dateLabel}</em></div>`;
                        }

                        html +=
                            `<span style="color:${this.series.color}"><b>${this.series.name}</b></span><br/>` +
                            `Monat: <b>${monthLabel}</b><br/>` +
                            `Fahrzeuge: <b>${Highcharts.numberFormat(this.y, 0)}</b>`;

                        return html;
                    }
                },
                series: [],
                credits: {
                    enabled: true,
                    text: 'Datenquelle: Verkehrszähldaten motorisierter Individualverkehr',
                    href: 'https://data.bs.ch/explore/dataset/100006/'
                },
                accessibility: {
                    description: 'Streudiagramm mit Einzelmessungen des Tagesverkehrs nach Monat und Richtung.',
                    point: {
                        valueDescriptionFormat: 'Monat: {xDescription}. Fahrzeuge: {value}.'
                    }
                }
            }
        }, {
            renderTo: 'monthly-box-plot-gesamt',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'boxplot',
                    height: '400px'
                },
                title: {
                    text: 'Verteilung des Tagesverkehrs – Gesamtquerschnitt'
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
                        text: 'Tagesverkehr'
                    }
                },
                series: [],
                tooltip: {
                    useHTML: true,
                    borderRadius: 8,
                    padding: 10,
                    style: {
                        fontSize: '14px',
                        lineHeight: '1.4'
                    },
                    headerFormat: '<em>Monat: <b>{point.key}</b></em><br/>',
                    pointFormat:
                        '<span style="color:{series.color}"><b>{series.name}</b></span><br/>' +
                        'Maximum: <b>{point.high}</b><br/>' +
                        '75%-Quantil: <b>{point.q3}</b><br/>' +
                        'Median: <b>{point.median}</b><br/>' +
                        '25%-Quantil: <b>{point.q1}</b><br/>' +
                        'Minimum: <b>{point.low}</b><br/>'
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
                    enabled: true,
                    text: 'Datenquelle: Verkehrszähldaten motorisierter Individualverkehr',
                    href: 'https://data.bs.ch/explore/dataset/100006/'
                },
                accessibility: {
                    description: 'Boxplot mit der Verteilung des Tagesverkehrs für den Gesamtquerschnitt nach Monat.',
                    point: {
                        valueDescriptionFormat: 'Minimum: {point.low}, Q1: {point.q1}, Median: {point.median}, Q3: {point.q3}, Maximum: {point.high}.'
                    }
                }
            }
        },
        {
            renderTo: 'monthly-scatter-plot-gesamt',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'scatter',
                    height: '400px'
                },
                title: {
                    text: 'Einzelmessungen Tagesverkehr – Gesamtquerschnitt'
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
                        text: 'Tagesverkehr (Einzelmessungen)'
                    }
                },
                plotOptions: {
                    scatter: {
                        jitter: {
                            x: 0.25,
                            y: 0
                        },
                        marker: {
                            radius: 3,
                            symbol: 'circle'
                        }
                    }
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
                        const categories = chart.xAxis[0].categories;

                        const monthIndex = Math.round(this.x);
                        const monthLabel = categories[monthIndex] || monthIndex;

                        const dateMs = this.point.date;
                        const hasDate = typeof dateMs === 'number';

                        const dateLabel = hasDate
                            ? Highcharts.dateFormat('%A, %d.%m.%Y', dateMs)
                            : '';

                        let html = '';
                        if (dateLabel) {
                            html += `<div style="margin-bottom:4px;"><em>${dateLabel}</em></div>`;
                        }

                        html +=
                            `<span style="color:${this.series.color}"><b>${this.series.name}</b></span><br/>` +
                            `Monat: <b>${monthLabel}</b><br/>` +
                            `Fahrzeuge: <b>${Highcharts.numberFormat(this.y, 0)}</b>`;

                        return html;
                    }
                },
                series: [],
                credits: {
                    enabled: true,
                    text: 'Datenquelle: Verkehrszähldaten motorisierter Individualverkehr',
                    href: 'https://data.bs.ch/explore/dataset/100006/'
                },
                accessibility: {
                    description: 'Streudiagramm mit Einzelmessungen des Tagesverkehrs für den Gesamtquerschnitt nach Monat.',
                    point: {
                        valueDescriptionFormat: 'Monat: {xDescription}. Fahrzeuge: {value}.'
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
        state.activeSpeed,
        state.activeTimeRange,
        true,
        true
    );
}