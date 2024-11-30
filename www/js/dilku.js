// Base URL and endpoint
const baseUrl = "http://localhost:8080";
const leadUpdate = "/update_leads";
const submitApiUrl = `${baseUrl}${leadUpdate}`;
  

async function fetchSentiment() {
  const form = document.getElementById("soa");
  const loader = document.getElementById("loader");
  const resultDiv = document.getElementById("myDiv");

  // Endpoint configurations
  //const baseUrl = "https://fintelle.wn.r.appspot.com";
  
  const sentimentEndpoint = "/sentiment_tracker";
  
  const sentimentApiUrl = `${baseUrl}${sentimentEndpoint}`;

  // Hide the content initially
  resultDiv.style.display = "none";

  // Prepare input data
  const dataInput = {
    TickerSymbol: document.getElementById("TickerSymbol").value,
    exchangeName: document.getElementById("exchangeName").value
  };

  const contact = {
    name : document.getElementById("fullName").value,
    email : document.getElementById("email").value,
    message : document.getElementById("TickerSymbol").value
  };

  console.log(dataInput);

  // Validate form input
  if (form.checkValidity()) {
    // Show the loader
    loader.style.display = "block";

    // Call the /update_lead endpoint without waiting for the response
    fetch(submitApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contact)
    }).catch(error => {
      // Handle errors (optional)
      console.error("Error submitting data:", error);
    });

    // Call the /sentiment_tracker endpoint and wait for the response
    try {
      const response = await fetch(sentimentApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataInput)
      });

      // Parse the JSON response
      const data = await response.json();

      // Hide the loader and update the content
      loader.style.display = "none";
      resultDiv.innerHTML = data.result || "<p>No result available.</p>";
      resultDiv.style.display = "block";
    } catch (error) {
      // Handle errors from the sentiment API
      loader.style.display = "none";
      resultDiv.innerHTML = "<p>Failed to load sentiment data. Please try again later.</p>";
      resultDiv.style.display = "block";
      console.error("Error fetching sentiment data:", error);
    }
  } else {
    // Highlight invalid form fields
    form.reportValidity();
  }
}

  async function fetchTicker() {
    const form = document.getElementById("soa");
    const loader = document.getElementById("loader");
    const resultDiv = document.getElementById("myDiv");

    const tickerAnalysisEndpoint = "/ticker_analysis";

  
    // Complete API URL
    const apiUrl = `${baseUrl}${tickerAnalysisEndpoint}`;
  
    // Hide the content initially
    resultDiv.style.display = "none";
  
    // Prepare the input data
    const dataInput = {
      TickerSymbol: document.getElementById("TickerSymbol").value,
      exchangeName: document.getElementById("exchangeName").value,
      period: document.getElementById("period").value
    };

    const contact = {
      name : document.getElementById("fullName").value,
      email : document.getElementById("email").value,
      message : document.getElementById("TickerSymbol").value
    };

    console.log(dataInput);
  
    if (form.checkValidity()) {
      // Show the loader
      loader.style.display = "block";
  
      // Call the /update_lead endpoint without waiting for the response
      fetch(submitApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contact)
      }).catch(error => {
        // Handle errors (optional)
        console.error("Error submitting data:", error);
      });

      try {
        // Send a POST request
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(dataInput)
        });
  
        // Parse the JSON response
        const data = await response.json();
  
        // Hide the loader
        loader.style.display = "none";
  
        // Update the content dynamically
        resultDiv.innerHTML = data.result || "<p>No result available.</p>";
        resultDiv.style.display = "block";
      } catch (error) {
        // Handle errors
        loader.style.display = "none";
        resultDiv.innerHTML = "<p>Failed to load data. Please try again later.</p>";
        resultDiv.style.display = "block";
        console.error("Error fetching ticker data:", error);
      }
    } else {
      // Highlight invalid form fields
      form.reportValidity();
    }
  }
  
  
  async function fetchQuote() {
    const formData = document.getElementById("soa");
    const loader = document.getElementById("loader");
    const resultDiv = document.getElementById("myDiv");
  
    // Prepare input data from form fields
    const dataInput = {
      //fullName: document.getElementById("fullName").value,
      dob: document.getElementById("dob").value,
      //email: document.getElementById("email").value,
      //phone: document.getElementById("phone").value,
      investmentObjective: document.getElementById("investmentObjective").value,
      investmentHorizon: document.getElementById("investmentHorizon").value,
      investmentAmount: document.getElementById("investmentAmount").value,
      riskTolerance: document.getElementById("riskTolerance").value
    };
    const contact = {
      name : document.getElementById("fullName").value,
      email : document.getElementById("email").value,
      message : document.getElementById("phone").value
    };

    // Hide the result div initially
    resultDiv.style.display = "none";
    const shareportfolioEndpoint = "/gen_share_portfolio";
  
    const portfolioApiUrl = `${baseUrl}${shareportfolioEndpoint}`;

    // Validate form and date of birth
    if (formData.checkValidity() && validateDOB()) {
      // Show the loader
      loader.style.display = "block";
      // Call the /update_lead endpoint without waiting for the response
      fetch(submitApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contact)
      }).catch(error => {
        // Handle errors (optional)
        console.error("Error submitting data:", error);
      });
  
      try {
        // Send the POST request to the API endpoint
        const response = await fetch(portfolioApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataInput)
        });
  
        // Parse the JSON response
        const data = await response.json();
  
        // Hide the loader after response
        loader.style.display = "none";
  
        // Update the content with the API data
        resultDiv.innerHTML = data.result || "<p>No result available.</p>";
        resultDiv.style.display = "block";
      } catch (error) {
        // Hide the loader and display error message if fetch fails
        loader.style.display = "none";
        resultDiv.innerHTML = "<p>Failed to load quote. Please try again.</p>";
        resultDiv.style.display = "block";
        console.error("Error fetching quote:", error);
      }
    } else {
      // If form is invalid, show form validation message
      formData.reportValidity();
    }
  }
  
    function validateDOB() {
        const dobInput = document.getElementById("dob").value;
        const dobError = document.getElementById("dobError");

        if (!dobInput) return false; // Ensure DOB is filled out

        // Parse the entered date of birth
        const dob = new Date(dobInput);
        const today = new Date();

        // Calculate age in years
        const age = today.getFullYear() - dob.getFullYear();
        const monthDifference = today.getMonth() - dob.getMonth();
        const dayDifference = today.getDate() - dob.getDate();

        // Adjust the age if the birth date hasn't occurred this year yet
        const actualAge = monthDifference < 0 || (monthDifference === 0 && dayDifference < 0) ? age - 1 : age;

        // Check if age is within the specified range
        if (actualAge < 15 || actualAge > 80) {
            dobError.style.display = "block";  // Show error message
            return false;  // Prevent form submission
        }

        dobError.style.display = "none";  // Hide error message if age is valid
        return true;  // Allow form submission
    }