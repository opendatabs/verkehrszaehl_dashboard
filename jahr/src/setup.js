import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {getStateFromUrl, getYearsInTimeRange, syncNavbarLinksFromUrl} from '../../src/functions.js';
import {
    getFilterComponent,
    getFzgtypFilterSectionComponent,
    getSpeedFilterSectionComponent,
    getDayRangeButtonsComponent,
    getBoxScatterToggleComponent
} from "../../src/common_components.js";
import {setupEventListeners} from "../../src/eventListeners.js";

export default async function setupBoard() {
    // Before any async work: Ansicht links must already carry multi zst_id from the URL
    syncNavbarLinksFromUrl();

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
        activeZsts: initialState.activeZsts,
        weekday: initialState.weekday
    };

    // A Jahresansicht needs at least one year
    const smallestZeiteinheitInDays = 365;
    const smallestZeiteinheitInMs = smallestZeiteinheitInDays * 24 * 3600 * 1000;

    if (state.activeTimeRange[1] - state.activeTimeRange[0] < smallestZeiteinheitInMs) {
        state.activeTimeRange[0] = state.activeTimeRange[1] - smallestZeiteinheitInMs;
    }

    // Categories (years) are set in updateBoard; initial ones follow the selected time range
    const yearCategories = getYearsInTimeRange(state.activeTimeRange).map(String);

    // --- dummy data to avoid empty-connector errors ---
    const dummyYearly = yearCategories.map((y, i) => ({
        year: y,
        year_index: i,
        // traffic
        dtv_ri1: 0,
        dtv_ri2: 0,
        dtv_total: 0,
        average_dtv_total: 0
    }));

    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
            {
                id: 'Yearly Traffic',
                type: 'JSON',
                // No Math dataModifier: it writes columns with setColumn(…, rowIndex 0), so the
                // modified table never shrinks when the number of years decreases (stale years remain)
                data: dummyYearly
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
                                            currentState.activeZsts,
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
            renderTo: 'year-table',
            type: 'Grid',
            connector: {
                id: 'Yearly Traffic'
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
            renderTo: 'yearly-dtv-chart',
            type: 'Highcharts',
            connector: {
                id: 'Yearly Traffic',
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
                    text: 'Durchschnittlicher Tagesverkehr (DTV) nach Jahr'
                },
                xAxis: {
                    categories: yearCategories,
                    title: {
                        text: 'Jahr'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Durchschnittlicher Tagesverkehr (DTV)'
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
                    description: 'A column chart showing the average daily traffic for each year.',
                    point: {
                        valueDescriptionFormat: 'Year: {xDescription}, Average Daily Traffic: {value}'
                    }
                }
            }
        },
            getBoxScatterToggleComponent('yearly', 'yearly'),
            {
            renderTo: 'yearly-box-plot',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'boxplot',
                    height: '400px'
                },
                title: {
                    text: 'Verteilung des Tagesverkehrs nach Jahr'
                },
                xAxis: {
                    categories: yearCategories,
                    title: {
                        text: 'Jahr'
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
                    headerFormat: '<em>Jahr: <b>{point.key}</b></em><br/>',
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
                    description: 'A box plot showing the distribution of daily traffic for each year.',
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
            renderTo: 'yearly-scatter-plot',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'scatter',
                    height: '400px'
                },
                title: {
                    text: 'Einzelmessungen Tagesverkehr nach Jahr'
                },
                xAxis: {
                    categories: yearCategories,
                    title: {
                        text: 'Jahr'
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

                        const yearIndex = Math.round(this.x);
                        const yearLabel = categories[yearIndex] || yearIndex;

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
                            `Jahr: <b>${yearLabel}</b><br/>` +
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
                    description: 'Streudiagramm mit Einzelmessungen des Tagesverkehrs nach Jahr und Richtung.',
                    point: {
                        valueDescriptionFormat: 'Jahr: {xDescription}. Fahrzeuge: {value}.'
                    }
                }
            }
        }, {
            renderTo: 'yearly-box-plot-gesamt',
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
                    categories: yearCategories,
                    title: {
                        text: 'Jahr'
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
                    headerFormat: '<em>Jahr: <b>{point.key}</b></em><br/>',
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
                    description: 'Boxplot mit der Verteilung des Tagesverkehrs für den Gesamtquerschnitt nach Jahr.',
                    point: {
                        valueDescriptionFormat: 'Minimum: {point.low}, Q1: {point.q1}, Median: {point.median}, Q3: {point.q3}, Maximum: {point.high}.'
                    }
                }
            }
        },
        {
            renderTo: 'yearly-scatter-plot-gesamt',
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
                    categories: yearCategories,
                    title: {
                        text: 'Jahr'
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

                        const yearIndex = Math.round(this.x);
                        const yearLabel = categories[yearIndex] || yearIndex;

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
                            `Jahr: <b>${yearLabel}</b><br/>` +
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
                    description: 'Streudiagramm mit Einzelmessungen des Tagesverkehrs für den Gesamtquerschnitt nach Jahr.',
                    point: {
                        valueDescriptionFormat: 'Jahr: {xDescription}. Fahrzeuge: {value}.'
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
        state.activeZsts,
        state.activeFzgtyp,
        state.activeSpeed,
        state.activeTimeRange,
        true,
        true
    );
}