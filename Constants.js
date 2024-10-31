/* eslint-disable jsdoc/require-description */
export const zweckColors = {
    "MIV": "#FF0000", // Red for Motorized Individual Transport
    "Velo/Moto": "#00FF00", // Green for Bicycles/Motorcycles
    "Fuss": "#0000FF", // Blue for Pedestrians
    // Add more as needed
};

export const colorRange = {
    minDTV: 0,      // Minimum expected DTV
    maxDTV: 10000,  // Maximum expected DTV
    colors: {
        low: '#0000FF',   // Blue for low traffic
        high: '#FF0000'   // Red for high traffic
    }
};


export const MathModifier = Dashboards.DataModifier.types.Math;

export const colorStopsDays = [
    [0.0, '#C2CAEB'],
    [1.0, '#162870']
];
export const colorStopsTemperature = [
    [0.0, '#4CAFFE'],
    [0.3, '#53BB6C'],
    [0.5, '#DDCE16'],
    [0.6, '#DF7642'],
    [0.7, '#DD2323']
];

export const tempRange = {
    minC: -10,
    maxC: 50,
    minF: 14,
    maxF: 122
};

export const KPIChartOptions = {
    chart: {
        height: 166,
        margin: [8, 8, 16, 8],
        spacing: [8, 8, 8, 8],
        styledMode: true,
        type: 'solidgauge'
    },
    pane: {
        background: {
            innerRadius: '90%',
            outerRadius: '120%',
            shape: 'arc'
        },
        center: ['50%', '70%'],
        endAngle: 90,
        startAngle: -90
    },
    series: [{
        data: [0],
        dataLabels: {
            format: '{y:.0f}',
            y: -34
        },
        animation: false,
        animationLimit: 0,
        enableMouseTracking: false,
        innerRadius: '90%',
        radius: '120%'
    }],
    yAxis: {
        labels: {
            distance: 4,
            y: 12
        },
        max: 10,
        min: 0,
        stops: colorStopsDays,
        tickAmount: 2,
        visible: true
    },
    accessibility: {
        typeDescription: 'The gauge chart with 1 data point.'
    }
};