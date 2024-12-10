export const gui = {
    layouts: [{
        rows: [{
            cells: [{
                id: 'filter-section'
            }]
        }, {
            cells: [{
                id: 'map',
                responsive: {
                    large: {
                        width: '1/2'
                    },
                    medium: {
                        width: '100%'
                    },
                    small: {
                        width: '100%'
                    }
                }
            }, {
                id: 'yearly-charts',
                layout: {
                    rows: [{
                        cells: [{id: 'yearly-chart'}]
                    },{
                        cells: [{id: 'availability-chart'}]
                    }]
                },
                responsive: {
                    large: {
                        width: '1/2'
                    },
                    medium: {
                        width: '100%'
                    },
                    small: {
                        width: '100%'
                    }
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