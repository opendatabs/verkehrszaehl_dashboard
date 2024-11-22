document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent the form from submitting normally

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // WARNING: This is not secure and should not be used in production
        if (username === 'verkehr_zaehlen' && password === 'macht_spass') {
            // Hide the login form and show the dashboard container
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('container').style.display = 'block';

            // Now initialize the dashboard
            if (typeof setupBoard === 'function') {
                await setupBoard();
            } else {
                console.error('setupBoard function is not available.');
            }
        } else {
            alert('Invalid username or password');
        }
    });
});
