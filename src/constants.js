// Prepare data for the Connector
export const stunde = [];
for (let i = 0; i < 24; i++) {
    stunde.push(i.toString().padStart(2, '0') + ':00');
}
export const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const wochentage = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];