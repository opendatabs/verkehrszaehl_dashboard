export const gui = {
    layouts: [{
        rows: [{
            cells: [{
                id: 'filter-section',
            }]
        }, {
            cells: [{
                id: 'filter-section-fzgtyp'
            }]
        },{
            cells: [{
                id: 'time-range-selector'
            }]
        }, {
            cells: [{
                id: 'filter-section-2'
            }]
        },{
            cells: [{
                id: 'hour-table'
            }, {
                id: 'hourly-charts',
                layout: {
                    rows: [{
                        cells: [{id: 'hourly-dtv-chart'}]
                    },{
                        cells: [{id: 'hourly-donut-chart'}]
                    }]
                }
            }]
        },{
            cells: [{
                id: 'filter-section-3'
            }]
        }, {
            cells: [{
                id: 'hourly-box-plot'
            }]
        },
        {
            cells: [{
                id: 'hourly-scatter-plot'
            }]
        }, {
            cells: [{
                id: 'hourly-box-plot-gesamt'
            }]
        },
        {
            cells: [{
                id: 'hourly-scatter-plot-gesamt'
            }]
        }]
    }]
};
