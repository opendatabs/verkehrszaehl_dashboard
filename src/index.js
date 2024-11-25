// src/main.js
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

    switch (hash) {
        case 'start':
            import('./start/setup.js').then(module => module.default());
            break;
        case 'stundenansicht':
            import('./stunde/setup.js').then(module => module.default());
            break;
        case 'monatsansicht':
            import('./monat/setup.js').then(module => module.default());
            break;
        case 'wochenansicht':
            import('./woche/setup.js').then(module => module.default());
            break;
        default:
            window.location.hash = '#start'; // Default to 'start' if hash is unrecognized
            break;
    }
}