import {getStateFromUrl, clearZeiteinheitSelection} from './functions.js';

export function setupEventListeners(updateBoard, board) {
    setupFilterButtonsListeners(updateBoard, board);
    setupStrTypButtonListeners(updateBoard, board);
    setupZaehlstellenDropdownListener(updateBoard, board);
    setupFahrzeugtypListeners(updateBoard, board);
    setupDayRangeButtons(updateBoard, board);
    setupDateInputsListeners(updateBoard, board);
    setupZeitraumButtonsListeners(updateBoard, board);
}


function setupFilterButtonsListeners(updateBoard, board) {
    document.querySelectorAll('#filter-buttons input[name="filter"]').forEach(filterElement => {
        filterElement.addEventListener('change', async event => {
            const currentState = getStateFromUrl();
            const activeType = event.target.value;
            await updateBoard(
                board,
                activeType,
                currentState.activeStrtyp,
                currentState.activeZst,
                currentState.activeFzgtyp,
                currentState.activeTimeRange,
                true,
                true
            );
        });
    });
}


function setupStrTypButtonListeners(updateBoard, board) {
    const radios = document.querySelectorAll('.filter-options input[name="filter-strtyp"]');
    let lastSelected = null;

    radios.forEach(radio => {
        radio.addEventListener('click', async function () {
            const currentState = getStateFromUrl();

            // If the same radio is clicked again
            if (lastSelected === this) {
                // Uncheck all radios
                radios.forEach(r => (r.checked = false));
                lastSelected = null;

                // Update the board with "Alle"
                await updateBoard(
                    board,
                    currentState.activeType,
                    'Alle',
                    currentState.activeZst,
                    currentState.activeFzgtyp,
                    currentState.activeTimeRange,
                    false,
                    false
                );
            } else {
                // Check only the current radio and uncheck others
                radios.forEach(r => (r.checked = false));
                this.checked = true;
                lastSelected = this;

                // Update the board with the selected value
                const activeStrtyp = this.value;
                await updateBoard(
                    board,
                    currentState.activeType,
                    activeStrtyp,
                    currentState.activeZst,
                    currentState.activeFzgtyp,
                    currentState.activeTimeRange,
                    false,
                    false
                );
            }
        });
    });
}


function setupZaehlstellenDropdownListener(updateBoard, board) {
    document.getElementById('zaehlstellen-dropdown').addEventListener('change', async event => {
        const currentState = getStateFromUrl();
        const activeZst = event.target.value;
        await updateBoard(
            board,
            currentState.activeType,
            currentState.activeStrtyp,
            activeZst,
            currentState.activeFzgtyp,
            currentState.activeTimeRange,
            false,
            true
        );
    });
}


function setupDayRangeButtons(updateBoard, board) {
    document.querySelectorAll('#day-range-buttons input[type="checkbox"]').forEach(button => {
        button.addEventListener('change', async (event) => {
            const currentState = getStateFromUrl();
            const moFr = document.querySelector('#mo-fr');
            const saSo = document.querySelector('#sa-so');

            // Ensure at least one button is always selected
            if (!moFr.checked && !saSo.checked) {
                event.target.checked = true; // Prevent unchecking the last selected button
            } else {
                // Update the board based on the new selection
                await updateBoard(
                    board,
                    currentState.activeType,
                    currentState.activeStrtyp,
                    currentState.activeZst,
                    currentState.activeFzgtyp,
                    currentState.activeTimeRange,
                    false,
                    false
                );
            }
        });
    });
}


function setupDateInputsListeners(updateBoard, board) {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    async function onDatePickersChange() {
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        if (startDateValue && endDateValue) {
            const min = Date.parse(startDateValue);
            const max = Date.parse(endDateValue) + (24 * 3600 * 1000 - 1); // End of day

            if (min > max) {
                alert('Das Startdatum darf nicht nach dem Enddatum liegen.');
                return;
            }

            // Clear "Zeitraum" selection
            clearZeiteinheitSelection();
            // Update time-range-selector extremes
            const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
            navigatorChart.xAxis[0].setExtremes(min, max);
        }
    }

    startDateInput.addEventListener('change', onDatePickersChange);
    endDateInput.addEventListener('change', onDatePickersChange);
}

function setupZeitraumButtonsListeners(updateBoard, board) {
    document.querySelectorAll('#day-range-buttons input[name="zeitraum"]').forEach(radio => {
        radio.addEventListener('change', async (event) => {
            if (event.target.checked) {
                const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
                console.log(navigatorChart);
                const max = navigatorChart.xAxis[0].dataMax
                let min;

                switch (event.target.value) {
                    case '1 Tag':
                        min = max - (24 * 3600 * 1000);
                        break;
                    case '1 Woche':
                        min = max - (7 * 24 * 3600 * 1000);
                        break;
                    case '1 Monat':
                        min = Date.UTC(new Date(max).getFullYear(), new Date(max).getMonth() - 1, new Date(max).getDate());
                        break;
                    case '1 Jahr':
                        min = Date.UTC(new Date(max).getFullYear() - 1, new Date(max).getMonth(), new Date(max).getDate());
                        break;
                    case 'Alles':
                        min = navigatorChart.xAxis[0].dataMin;
                        break;
                    default:
                        return;
                }

                navigatorChart.xAxis[0].setExtremes(min, max);
            }
        });
    });
}

function setupFahrzeugtypListeners(updateBoard, board) {
    const vehicleTypeDropdown = document.getElementById('vehicle-type-dropdown');

    vehicleTypeDropdown.addEventListener('change', async event => {
        const activeFzgtyp = event.target.value;
        const currentState = getStateFromUrl();
        await updateBoard(
            board,
            currentState.activeType,
            currentState.activeStrtyp,
            currentState.activeZst,
            activeFzgtyp,
            currentState.activeTimeRange,
            false,
            true
        );
    });
}
