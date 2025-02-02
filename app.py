from flask import Flask, request, jsonify
from flask_cors import CORS  # Import CORS
import boto3
import os
import mylib

app = Flask(__name__)
CORS(app)

# AWS SES Configuration
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
CHARSET = "UTF-8"

# Initialize the AWS SES client
ses_client = boto3.client("ses", region_name=AWS_REGION)

# Hardcoded sender email
SENDER_EMAIL = "info@advicegenie.com.au"

@app.route("/send-email", methods=["POST"])
def send_email():
    try:
        data = request.get_json()

        # Extract required fields
        recipient = data["recipient"]
        subject = data["subject"]
        body = data["body"]

        # Validate input
        if not all([recipient, subject, body]):
            return jsonify({"error": "All fields (recipient, subject, body) are required"}), 400

        # Send the email via SES
        response = ses_client.send_email(
            Source=SENDER_EMAIL,  # Use hardcoded sender email
            Destination={"ToAddresses": [recipient]},
            Message={
                "Subject": {"Data": subject, "Charset": CHARSET},
                "Body": {"Text": {"Data": body, "Charset": CHARSET}},
            },
        )

        return jsonify({"message": "Email sent successfully", "response": response}), 200

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
    dob = data.get('dob')
    financial_goal = data.get('financialGoal')
    investment_amount = data.get('investmentAmount')  # New field
    risk_tolerance = data.get('riskTolerance')

    # Check if all required fields are present
    if not all([full_name, email, phone, dob, financial_goal, investment_amount, risk_tolerance]):
        return jsonify({"error": "Missing required fields"}), 400

    # Get Google Sheet instance
    sheet = mylib.get_google_sheet()

    # Append row data to Google Sheet
    sheet.append_row([
        full_name, 
        email, 
        phone, 
        dob, 
        financial_goal, 
        investment_amount,  # New field
        risk_tolerance
    ])

    # Prepare customer details for financial advisor
    customer_details = {
        # Disabled fields: full_name, email, phone
        "dob": dob,
        "financial_goal": financial_goal,
        "investment_amount": investment_amount,  # New field
        "risk_tolerance": risk_tolerance
    }

    # Get financial advice
    # analysis = mylib.financialAdvisor(customer_details)
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
            <p><strong>Date of Birth:</strong> {dob}</p>
            <p><strong>Financial Goal:</strong> {financial_goal}</p>
            <p><strong>Investment Amount:</strong> {investment_amount}</p>
            <p><strong>Risk Tolerance:</strong> {risk_tolerance}</p>
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
                "Subject": {"Data": f"Financial Analysis for {full_name}", "Charset": CHARSET},
                "Body": {"Html": {"Data": email_body, "Charset": CHARSET}},  # Use HTML body
            },
        )
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
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