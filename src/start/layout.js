export const gui = {
    layouts: [{
        rows: [{
            cells: [{
                id: 'filter-section',
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
            },
            {
                id: 'world-map',
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
                id: 'daily-traffic-by-year',
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
                id: 'dtv-graph',
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
        }]
    }]
}