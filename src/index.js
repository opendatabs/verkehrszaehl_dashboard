function parseParams() {
    const urlParams = new URLSearchParams(window.location.search);

    return {
        traffic_type: urlParams.get('traffic_type') || 'MIV',
        zst_id: urlParams.get('zst_id') || null, // Default to null if not provided
        start_date: urlParams.get('start_date') || '2023-01-01',
        end_date: urlParams.get('end_date') || '2023-12-31',
        weekday: urlParams.get('weekday') || 'mo-so',
    };
}

window.addEventListener('hashchange', onHashChange);
window.addEventListener('load', onHashChange);

document.addEventListener('DOMContentLoaded', () => {
    // Set the "Start" button as active on load
    const startButton = document.querySelector('.navbar-link[href="#start"]');
    if (startButton) {
        startButton.classList.add('active');
    }

    // Add event listeners to update active link on click
    document.querySelectorAll('.navbar-link').forEach(link => {
        link.addEventListener('click', () => {
            // Remove active class from all links
            document.querySelectorAll('.navbar-link').forEach(btn => btn.classList.remove('active'));

            // Add active class to the clicked link
            link.classList.add('active');
        });
    });
});


function clearContainer() {
    const container = document.getElementById('container');
    container.innerHTML = ''; // Clear previous content
}

function onHashChange() {
    clearContainer();
    const hash = window.location.hash.substr(1); // Remove the '#' character
    const params = parseParams();

    switch (hash) {
        case 'start':
            import('./start/setup.js').then(module => module.default(params));
            break;
        case 'stundenansicht':
            import('./stunde/setup.js').then(module => module.default(params));
            break;
        case 'monatsansicht':
            import('./monat/setup.js').then(module => module.default(params));
            break;
        case 'wochenansicht':
            import('./woche/setup.js').then(module => module.default(params));
            break;
        default:
            window.location.hash = '#start'; // Default to 'start' if hash is unrecognized
            break;
    }
}