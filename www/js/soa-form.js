// script.js
// Define the backend host as a variable
//const backendHost = 'http://localhost:8080'; // You can change this to your production URL when needed
const backendHost = 'https://fintelle.wn.r.appspot.com'; 

// Function to handle form submission
function submitForm() {
    // Collect all form data
    const formData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        dob: document.getElementById('dob').value,
        financialGoal: document.querySelector('input[name="financialGoal"]:checked').value,
        income: document.getElementById('income').value,
        expenses: document.getElementById('expenses').value,
        savings: document.getElementById('savings').value,
        debts: document.getElementById('debts').value,
        riskTolerance: document.querySelector('input[name="riskTolerance"]:checked').value
    };

    // Send the data to the backend
    fetch(`${backendHost}/update_leads`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            // Redirect to the thank-you page after successful submission
            window.location.href = "thank-you.html";
        } else {
            alert('Failed to submit form. Please try again.');
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('Failed to submit form. Check all the fields are filled. Please try again.');
    });
}

// Add event listener to the submit button
document.getElementById('submitForm').addEventListener('click', submitForm);

// Form Navigation Logic
const steps = document.querySelectorAll('.form-step');
const progressBar = document.getElementById('progressBar');
let currentStep = 0;

function showStep(stepIndex) {
    steps.forEach((step, index) => {
        step.classList.toggle('active', index === stepIndex);
    });
    const progress = ((stepIndex + 1) / steps.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
}

document.querySelectorAll('.next-step').forEach(button => {
    button.addEventListener('click', () => {
        if (currentStep < steps.length - 1) {
            currentStep++;
            showStep(currentStep);
        }
        if (currentStep === steps.length - 1) {
            // Populate review details
            const reviewDetails = document.getElementById('reviewDetails');
            reviewDetails.innerHTML = `
                <p><strong>Name:</strong> ${document.getElementById('fullName').value}</p>
                <p><strong>Email:</strong> ${document.getElementById('email').value}</p>
                <p><strong>Phone:</strong> ${document.getElementById('phone').value}</p>
                <p><strong>Date of Birth:</strong> ${document.getElementById('dob').value}</p>
                <p><strong>Financial Goals:</strong> ${document.querySelector('input[name="financialGoal"]:checked').value}</p>
                <p><strong>Annual Income:</strong> $${document.getElementById('income').value}</p>
                <p><strong>Monthly Expenses:</strong> $${document.getElementById('expenses').value}</p>
                <p><strong>Current Savings:</strong> $${document.getElementById('savings').value}</p>
                <p><strong>Total Debts:</strong> $${document.getElementById('debts').value}</p>
                <p><strong>Risk Tolerance:</strong> ${document.querySelector('input[name="riskTolerance"]:checked').value}</p>
            `;
        }
    });
});

document.querySelectorAll('.prev-step').forEach(button => {
    button.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            showStep(currentStep);
        }
    });
});