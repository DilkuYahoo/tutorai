from flask import Flask, request, jsonify
from flask_cors import CORS  # Import CORS
import boto3
import os
import mylib
import base64
from datetime import datetime  # Import datetime module

app = Flask(__name__)
CORS(app)

# AWS SES Configuration
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
CHARSET = "UTF-8"

# Initialize the AWS SES client
ses_client = boto3.client("ses", region_name=AWS_REGION)

# Hardcoded sender email
SENDER_EMAIL = "info@mail.advicegenie.com.au"

@app.route("/send-email", methods=["POST"])
def send_email():
    try:
        # Get data from the JSON payload
        data = request.get_json()
        recipient = data.get("recipient")
        subject = data.get("subject")
        body = data.get("body")
        body_type = data.get("body_type", "text")  # Default to "text" if not provided
        attachment = data.get("attachment")
        attachment_name = data.get("attachment_name")
        attachment_type = data.get("attachment_type")

        # Validate input
        if not all([recipient, subject, body]):
            return jsonify({"error": "All fields (recipient, subject, body) are required"}), 400

        # Determine the body content type
        body_content_type = "text/html" if body_type.lower() == "html" else "text/plain"

        # Prepare the email structure
        message = {
            "Subject": {"Data": subject, "Charset": CHARSET},
            "Body": {
                "Html" if body_type.lower() == "html" else "Text": {"Data": body, "Charset": CHARSET}
            },
        }

        # Handle attachment if provided
        if attachment and attachment_name and attachment_type:
            attachment_data = base64.b64decode(attachment)
            raw_message = {
                "Source": SENDER_EMAIL,
                "Destinations": [recipient],
                "RawMessage": {
                    "Data": f"From: {SENDER_EMAIL}\nTo: {recipient}\nSubject: {subject}\nMIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=boundary\n\n--boundary\nContent-Type: {body_content_type}; charset=UTF-8\n\n{body}\n\n--boundary\nContent-Type: {attachment_type}; name={attachment_name}\nContent-Disposition: attachment; filename={attachment_name}\nContent-Transfer-Encoding: base64\n\n{attachment}\n\n--boundary--"
                }
            }
            response = ses_client.send_raw_email(**raw_message)
        else:
            response = ses_client.send_email(
                Source=SENDER_EMAIL,
                Destination={"ToAddresses": [recipient]},
                Message=message,
            )

        return jsonify({"message": "Email sent successfully", "response": response}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500    




@app.route('/get_soi', methods=['POST'])
def get_soi():
    # Validate JSON input
    if not request.is_json:
        return jsonify({"error": "Invalid input: JSON data expected"}), 400

    data = request.get_json()

    # Extract all the required fields from JSON data (based on insurance.html form)
    full_name = data.get('fullName')
    email = data.get('email')
    phone = data.get('phone')
    age = data.get('age')
    annual_income = data.get('annualIncome')
    dependents = data.get('dependents')
    debts = data.get('debts')
    survival_months = data.get('survivalMonths')
    occupation = data.get('occupation')
    medical_conditions = data.get('medicalConditions')
    smoke_drink = data.get('smokeDrink')
    insurance_type = data.get('insuranceType')
    health_coverage = data.get('healthCoverage')
    monthly_premium = data.get('monthlyPremium')
    existing_policies = data.get('existingPolicies')
    payout_preference = data.get('payoutPreference')

    # Check if all required fields are present
    required_fields = [
        full_name, email, phone, age, annual_income, dependents, debts, 
        survival_months, occupation, medical_conditions, smoke_drink, 
        insurance_type, health_coverage, monthly_premium
    ]
    if not all(required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    # Get the current date and local time
    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Get Google Sheet instance
    sheet = mylib.get_google_sheet("leads", "Sheet1")  # Use a different sheet for insurance leads

    # Append row data to Google Sheet, including the current date and time
    sheet.append_row([
        full_name, 
        email, 
        phone, 
        age, 
        annual_income, 
        dependents, 
        debts, 
        survival_months, 
        occupation, 
        medical_conditions, 
        smoke_drink, 
        insurance_type, 
        health_coverage, 
        monthly_premium, 
        existing_policies, 
        payout_preference,
        current_datetime  # Add the current date and time
    ])

    # Prepare customer details for insurance advice
    customer_details = {
        #"full_name": full_name,
        #"email": email,
        #"phone": phone,
        "age": age,
        "annual_income": annual_income,
        "dependents": dependents,
        "debts": debts,
        "survival_months": survival_months,
        "occupation": occupation,
        "medical_conditions": medical_conditions,
        "smoke_drink": smoke_drink,
        "insurance_type": insurance_type,
        "health_coverage": health_coverage,
        "monthly_premium": monthly_premium,
        "existing_policies": existing_policies,
        "payout_preference": payout_preference
    }

    # Get insurance advice
    analysis = mylib.insuranceAdvice(customer_details)

    # Construct the email body with HTML formatting
    email_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            h1 {{ color: #333366; }}
            .customer-details {{ background-color: #f4f4f4; padding: 10px; border-radius: 5px; }}
            .analysis {{ margin-top: 20px; }}
        </style>
    </head>
    <body>
        <h1>Customer Details</h1>
        <div class="customer-details">
            <p><strong>Full Name:</strong> {full_name}</p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Phone:</strong> {phone}</p>
            <p><strong>Age:</strong> {age}</p>
            <p><strong>Annual Income:</strong> {annual_income}</p>
            <p><strong>Dependents:</strong> {dependents}</p>
            <p><strong>Debts:</strong> {debts}</p>
            <p><strong>Survival Months:</strong> {survival_months}</p>
            <p><strong>Occupation:</strong> {occupation}</p>
            <p><strong>Medical Conditions:</strong> {medical_conditions}</p>
            <p><strong>Smoke/Drink:</strong> {smoke_drink}</p>
            <p><strong>Insurance Type:</strong> {insurance_type}</p>
            <p><strong>Health Coverage:</strong> {health_coverage}</p>
            <p><strong>Monthly Premium:</strong> {monthly_premium}</p>
            <p><strong>Existing Policies:</strong> {existing_policies}</p>
            <p><strong>Payout Preference:</strong> {payout_preference}</p>
            <p><strong>Date and Time:</strong> {current_datetime}</p>
        </div>
        <div class="analysis">
            <h1>Insurance Analysis</h1>
            {analysis}
        </div>
    </body>
    </html>
    """

    # Send the analysis via email
    try:
        response = ses_client.send_email(
            Source=SENDER_EMAIL,  # Use hardcoded sender email
            Destination={"ToAddresses": ["info@advicegenie.com.au"]},
            Message={
                "Subject": {"Data": f"Statement of Insurance for {full_name}", "Charset": CHARSET},
                "Body": {"Html": {"Data": email_body, "Charset": CHARSET}},
            },
        )
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    


@app.route('/update_leads', methods=['POST'])
def update_leads():
    # Validate JSON input
    if not request.is_json:
        return jsonify({"error": "Invalid input: JSON data expected"}), 400

    data = request.get_json()

    # Extract all the required fields from JSON data
    full_name = data.get('fullName')
    email = data.get('email')
    phone = data.get('phone')
    age = data.get('age')
    financial_goal = data.get('financialGoal')
    investment_amount = data.get('investmentAmount')  # New field
    risk_tolerance = data.get('riskTolerance')

    # Check if all required fields are present
    if not all([full_name, email, phone, age, financial_goal, investment_amount, risk_tolerance]):
        return jsonify({"error": "Missing required fields"}), 400

    # Get the current date and local time
    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Get Google Sheet instance
    sheet = mylib.get_google_sheet("leads","Sheet1")

    # Append row data to Google Sheet, including the current date and time
    sheet.append_row([
        full_name, 
        email, 
        phone, 
        age, 
        financial_goal, 
        investment_amount,  # New field
        risk_tolerance,
        current_datetime  # Add the current date and time
    ])

    # Prepare customer details for financial advisor
    customer_details = {
        # Disabled fields: full_name, email, phone
        "age": age,
        "financial_goal": financial_goal,
        "investment_amount": investment_amount,  # New field
        "risk_tolerance": risk_tolerance
    }

    # Get financial advice
    analysis = mylib.financialAdvisor(customer_details)

    # Construct the email body with HTML formatting
    email_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            h1 {{ color: #333366; }}
            .customer-details {{ background-color: #f4f4f4; padding: 10px; border-radius: 5px; }}
            .analysis {{ margin-top: 20px; }}
        </style>
    </head>
    <body>
        <h1>Customer Details</h1>
        <div class="customer-details">
            <p><strong>Full Name:</strong> {full_name}</p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Phone:</strong> {phone}</p>
            <p><strong>Age:</strong> {age}</p>
            <p><strong>Financial Goal:</strong> {financial_goal}</p>
            <p><strong>Investment Amount:</strong> {investment_amount}</p>
            <p><strong>Risk Tolerance:</strong> {risk_tolerance}</p>
            <p><strong>Date and Time:</strong> {current_datetime}</p>
        </div>
        <div class="analysis">
            <h1>Financial Analysis</h1>
            {analysis}
        </div>
    </body>
    </html>
    """

    # Send the analysis via email
    try:
        response = ses_client.send_email(
            Source=SENDER_EMAIL,  # Use hardcoded sender email
            Destination={"ToAddresses": ["info@advicegenie.com.au"]},
            Message={
                "Subject": {"Data": f"Statement of Advice for {full_name}", "Charset": CHARSET},
                "Body": {"Html": {"Data": email_body, "Charset": CHARSET}},  # Use HTML body
            },
        )
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

from datetime import datetime  # Import datetime module (if not already imported)

@app.route("/onboard_advisors", methods=["POST"])
def onboard_advisors():
    try:
        # Validate JSON input
        if not request.is_json:
            return jsonify({"error": "Invalid input: JSON data expected"}), 400

        data = request.get_json()

        # Extract all the required fields from JSON data
        name = data.get('name')
        phone = data.get('phone')
        email = data.get('email')
        afsl = data.get('afsl')
        business_name = data.get('businessName')
        business_address = data.get('businessAddress')
        business_url = data.get('businessURL')
        agreement1 = data.get('agreement1')
        agreement2 = data.get('agreement2')

        # Check if all required fields are present
        if not all([name, phone, email, afsl, business_name, business_address, business_url, agreement1, agreement2]):
            return jsonify({"error": "Missing required fields"}), 400

        # Validate that the user agreed to the terms and conditions
        if not (agreement1 and agreement2):
            return jsonify({"error": "You must agree to both the engagement and privacy terms"}), 400

        # Get the current date and local time
        current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Append data to Google Sheet, including the current date and time
        sheet = mylib.get_google_sheet("leads", "Sheet2")
        sheet.append_row([
            name, 
            phone, 
            email, 
            afsl, 
            business_name, 
            business_address, 
            business_url, 
            agreement1, 
            agreement2,
            current_datetime  # Add the current date and time
        ])

        # Construct the email body with HTML formatting, including the date and time
        email_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; }}
                h1 {{ color: #333366; }}
                .details {{ background-color: #f4f4f4; padding: 10px; border-radius: 5px; }}
            </style>
        </head>
        <body>
            <h1>New Advisor Onboarding</h1>
            <div class="details">
                <p><strong>Name:</strong> {name}</p>
                <p><strong>Phone:</strong> {phone}</p>
                <p><strong>Email:</strong> {email}</p>
                <p><strong>AFSL Number:</strong> {afsl}</p>
                <p><strong>Business Name:</strong> {business_name}</p>
                <p><strong>Business Address:</strong> {business_address}</p>
                <p><strong>Business URL:</strong> {business_url}</p>
                <p><strong>Agreed on Engagement:</strong> {"Yes" if agreement1 else "No"}</p>
                <p><strong>Agreed on Privacy:</strong> {"Yes" if agreement2 else "No"}</p>
                <p><strong>Date and Time:</strong> {current_datetime}</p>
            </div>
        </body>
        </html>
        """

        # Send an email to the admin
        response = ses_client.send_email(
            Source=SENDER_EMAIL,
            Destination={"ToAddresses": ["info@advicegenie.com.au"]},
            Message={
                "Subject": {"Data": f"New Advisor Onboarding: {name}", "Charset": CHARSET},
                "Body": {"Html": {"Data": email_body, "Charset": CHARSET}},
            },
        )

        return jsonify({"message": "Advisor onboarding data received and processed", "email_response": response}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"message": "Flask app is running"}), 200

@app.route('/multiply', methods=['POST'])
def multiply():
    try:
        # Get 'a' and 'b' from the JSON body of the request
        data = request.get_json()
        a = float(data.get('a'))
        b = float(data.get('b'))
        result = a * b
        return jsonify({'result': result}), 200
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid input. Please provide numerical values for a and b.'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500