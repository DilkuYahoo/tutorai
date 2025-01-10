const baseUrl = "https://fintelle.wn.r.appspot.com";
// const baseUrl = "http://localhost:8080";

document.addEventListener("DOMContentLoaded", () => {
    const steps = document.querySelectorAll(".form-step");
    let currentStep = 0;

    const showStep = (index) => {
        steps.forEach((step, i) => {
            step.classList.toggle("d-none", i !== index);
            step.classList.toggle("active", i === index);
        });
    };

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

    const validateStep2 = () => {
        const riskTolerance = document.getElementById("riskTolerance").value;

        if (!riskTolerance) {
            alert("Please select your risk tolerance.");
            return false;
        }
        return true;
    };

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

    const submitForm = () => {
        alert("Please check your email for the SoA.");

        const formInvData = {
            investmentObjective: document.getElementById("investmentObjective").value,
            investmentHorizon: document.getElementById("investmentHorizon").value,
            investmentAmount: document.getElementById("investmentAmount").value,
            riskTolerance: document.getElementById("riskTolerance").value,
        };

        const formContData = {
            fullName: document.getElementById("fullName").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
        };

        // Call the first API endpoint
        fetch(`${baseUrl}/gen_share_portfolio`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formInvData),
        }).catch((error) => console.error("Error calling /gen_share_portfolio:", error));

        // Call the second API endpoint
        fetch(`${baseUrl}/update_leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formContData),
        }).catch((error) => console.error("Error calling /update_leads:", error));

        // Redirect to the home page
        window.location.href = "https://advicegenie.com.au";
    };

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

    const prev2Button = document.getElementById("prev-2");
    if (prev2Button) {
        prev2Button.addEventListener("click", () => {
            currentStep--;
            showStep(currentStep);
        });
    }

    const prev3Button = document.getElementById("prev-3");
    if (prev3Button) {
        prev3Button.addEventListener("click", () => {
            currentStep--;
            showStep(currentStep);
        });
    }

    document.getElementById("funnelForm").addEventListener("submit", (e) => {
        e.preventDefault();
        if (validateStep3()) {
            submitForm();
        }
    });

    showStep(currentStep);
});
