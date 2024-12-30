document.addEventListener("DOMContentLoaded", () => {
    const steps = document.querySelectorAll(".form-step");
    let currentStep = 0;

    // Function to show the current step
    const showStep = (index) => {
        steps.forEach((step, i) => {
            step.classList.toggle("d-none", i !== index);
            step.classList.toggle("active", i === index);
        });
    };

    // Validation for Step 1: Investment Goals
    const validateStep1 = () => {
        const investmentObjective = document.getElementById("investmentObjective").value;
        const investmentHorizon = document.getElementById("investmentHorizon").value;
        const investmentAmount = document.getElementById("investmentAmount").value;

        if (!investmentObjective || !investmentHorizon || !investmentAmount || investmentAmount <= 0) {
            alert("Please fill out all fields in Investment Goals.");
            return false;
        }
        return true;
    };

    // Validation for Step 2: Risk Profile
    const validateStep2 = () => {
        const riskTolerance = document.getElementById("riskTolerance").value;

        if (!riskTolerance) {
            alert("Please select your risk tolerance.");
            return false;
        }
        return true;
    };

    // Validation for Step 3 (merged): Personal Information & Disclaimer
    const validateStep3 = () => {
        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const acceptDisclaimer = document.getElementById("acceptDisclaimer").checked;

        if (!fullName || !email || !phone) {
            alert("Please complete all fields in Personal Information.");
            return false;
        }

        if (!phone.match(/^\+61[0-9]{9}$/)) {
            alert("Please enter a valid phone number in the format +61400000000.");
            return false;
        }

        if (!acceptDisclaimer) {
            alert("You must accept the disclaimer to proceed.");
            return false;
        }

        return true;
    };

    // Navigation: Next buttons
    document.getElementById("next-1").addEventListener("click", () => {
        if (validateStep1()) {
            currentStep++;
            showStep(currentStep);
        }
    });

    document.getElementById("next-2").addEventListener("click", () => {
        if (validateStep2()) {
            currentStep++;
            showStep(currentStep);
        }
    });

    // Navigation: Previous buttons
    document.getElementById("prev-2").addEventListener("click", () => {
        currentStep--;
        showStep(currentStep);
    });

    document.getElementById("prev-3").addEventListener("click", () => {
        currentStep--;
        showStep(currentStep);
    });

    // Form submission
    document.getElementById("funnelForm").addEventListener("submit", (e) => {
        e.preventDefault(); // Prevent default form submission
        if (validateStep3()) {
            alert("Form submitted successfully!");
            // You can replace this alert with an actual form submission logic
            // e.g., sending data via AJAX or navigating to a success page
        }
    });

    // Initialize form to display the first step
    showStep(currentStep);
});
