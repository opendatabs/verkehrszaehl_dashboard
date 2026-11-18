export const gui = {
    layouts: [{
        rows: [{
            cells: [{
                id: 'filter-section',
            }]
        },{
            cells: [{
                id: 'filter-section-fzgtyp'
            }]
        }, {
            cells: [{
                id: 'filter-section-speed'
            }]
        }, {
            cells: [{
                id: 'filter-section-2'
            }]
        },{
            cells: [{
                id: 'time-range-selector'
            }]
        },{
            cells: [{
                id: 'warning-box-section'
            }]
        },{
            cells: [{
                id: 'year-table',
            }, {
                id: 'yearly-charts',
                layout: {
                    rows: [{
                        cells: [{id: 'yearly-dtv-chart'}]
                    }]
                }
            }]
        }, {
            cells: [{
                id: 'verteilung-section',
                layout: {
                    rows: [{
                        cells: [{
                            id: 'filter-section-3'
                        }]
                    }, {
                        cells: [{
                            id: 'yearly-box-plot'
                        }]
                    }, {
                        cells: [{
                            id: 'yearly-scatter-plot'
                        }]
                    }, {
                        cells: [{
                            id: 'yearly-box-plot-gesamt'
                        }]
                    }, {
                        cells: [{
                            id: 'yearly-scatter-plot-gesamt'
                        }]
                    }]
                }
            }]
        }]
    }]
}
