import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {getStateFromUrl} from '../../src/functions.js';
import {getFilterComponent, getDayRangeButtonsComponent, getBoxScatterToggleComponent} from "../../src/common_components.js";
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
        activeTimeRange: initialState.activeTimeRange,
        activeStrtyp: initialState.activeStrtyp,
        activeType: initialState.activeType,
        activeFzgtyp: initialState.activeFzgtyp,
        activeZst: initialState.activeZst,
        weekday: initialState.weekday
    };

    const smallestZeiteinheitInDays = 7;
    const smallestZeiteinheitInMs = smallestZeiteinheitInDays * 24 * 3600 * 1000;

    if (state.activeTimeRange[1] - state.activeTimeRange[0] < smallestZeiteinheitInMs) {
        state.activeTimeRange[0] = state.activeTimeRange[1] - smallestZeiteinheitInMs;
    }

    // --- dummy data so components don't crash before updateBoard runs ---
    const weekdayKeys = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    const dummyWeekly = weekdayKeys.map((w, i) => ({
        weekday: w,
        weekday_index: i,
        dtv_ri1: 0,
        dtv_ri2: 0,
        dtv_total: 0,
        average_dtv_total: 0
    }));

    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
            {
                id: 'Weekly Traffic',
                type: 'JSON',
                data: dummyWeekly,
                dataModifier: {
                    'type': 'Math',
                }
            }]
        },
        gui,
        components: [
            getFilterComponent(),
        {
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
                    minRange: smallestZeiteinheitInMs,
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
            getDayRangeButtonsComponent(state.weekday, smallestZeiteinheitInDays),
        {
            renderTo: 'weekly-table',
            type: 'Grid',
            connector: {
                id: 'Weekly Traffic'
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
                    enabled: true
                },
                rendering: {
                    theme: 'hcg-theme-default bs-grid-theme'
                }
            }
        }, {
            renderTo: 'weekly-dtv-chart',
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
        },
        getBoxScatterToggleComponent(),
        {
                renderTo: 'weekly-box-plot',
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
                            text: 'Tagesverkehr'
                        }
                    },
                    series: [],
                    tooltip: {
                        headerFormat: '<em>Wochentag: <b>{point.key}</b></em><br/>',
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
                        enabled: true
                    },
                    accessibility: {
                        description: 'A box plot showing the distribution of daily traffic for each weekday (Mo to So).',
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
                renderTo: 'weekly-scatter-plot',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'scatter',
                        height: '400px'
                    },
                    title: {
                        text: 'Einzelmessungen Tagesverkehr nach Wochentag'
                    },
                    xAxis: {
                        categories: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
                        title: {
                            text: 'Wochentag'
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
                                x: 0.08,
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
                        formatter: function () {
                            const chart = this.series.chart;
                            const categories = chart.xAxis[0].categories;

                            const weekdayIndex = Math.round(this.x);
                            const weekdayLabel = categories[weekdayIndex] || weekdayIndex;

                            const date = this.point.date
                                ? Highcharts.dateFormat('%d.%m.%Y', this.point.date)
                                : '';

                            return `
                            <b>${this.series.name}</b><br/>
                            Wochentag: ${weekdayLabel}<br/>
                            Datum: ${date}<br/>
                            Fahrzeuge: <b>${Highcharts.numberFormat(this.y, 0)}</b>
                        `;
                        }
                    },
                    series: [],
                    credits: {
                        enabled: true
                    },
                    accessibility: {
                        description: 'Streudiagramm mit Einzelmessungen des Tagesverkehrs nach Wochentag und Richtung.',
                        point: {
                            valueDescriptionFormat: 'Wochentag: {xDescription}. Fahrzeuge: {value}.'
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