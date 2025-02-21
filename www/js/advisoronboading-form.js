document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("advisorOnboardingForm");
    const steps = document.querySelectorAll(".form-step");
    const progressBar = document.getElementById("progressBar");
    let currentStep = 0;

    function updateProgress() {
        const progress = ((currentStep + 1) / steps.length) * 100;
        progressBar.style.width = progress + "%";
    }

    function showStep(stepIndex) {
        steps.forEach((step, index) => {
            step.classList.toggle("active", index === stepIndex);
        });
        updateProgress();
    }

    document.querySelectorAll(".next-step").forEach(button => {
        button.addEventListener("click", function () {
            const nextStepId = this.getAttribute("data-next");
            const nextStepIndex = Array.from(steps).findIndex(step => step.id === nextStepId);
            if (validateStep(currentStep)) {
                currentStep = nextStepIndex;
                showStep(currentStep);
            }
        });
    });

    document.querySelectorAll(".prev-step").forEach(button => {
        button.addEventListener("click", function () {
            const prevStepId = this.getAttribute("data-prev");
            const prevStepIndex = Array.from(steps).findIndex(step => step.id === prevStepId);
            currentStep = prevStepIndex;
            showStep(currentStep);
        });
    });

    function validateStep(stepIndex) {
        const fields = steps[stepIndex].querySelectorAll("input, textarea, select");
        for (let field of fields) {
            if (!field.checkValidity()) {
                field.reportValidity();
                return false;
            }
        }
        return true;
    }

    form.addEventListener("submit", function (event) {
        if (!validateStep(currentStep)) {
            event.preventDefault();
        } else {
            alert("Form submitted successfully!");
        }
    });

    showStep(currentStep);
});
