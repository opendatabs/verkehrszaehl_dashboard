export const gui = {
    layouts: [{
        rows: [{
            cells: [{
                id: 'filter-section'
            }]
        }, {
            cells: [{
                id: 'map'
            }, {
                id: 'yearly-charts',
                layout: {
                    rows: [{
                        cells: [{id: 'yearly-chart'}]
                    },{
                        cells: [{id: 'availability-chart'}]
                    }]
                }
            }]
        },{
            cells: [{
                id: 'time-range-selector'
            }]
        }, {
            cells: [{
                id: 'filter-section-2'
            }]
        }, {
            cells: [{
                id: 'tv-chart'
            }]
        },
        {
            cells: [{
                id: 'weather-chart'
            }]
        }]
    }]
}