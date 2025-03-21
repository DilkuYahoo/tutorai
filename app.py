from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import mylib

app = Flask(__name__)
CORS(app)

@app.route("/send-email", methods=["POST"])
def send_email():
    try:
        data = request.get_json()
        recipient = data.get("recipient")
        subject = data.get("subject")
        body = data.get("body")
        body_type = data.get("body_type", "text")
        attachment = data.get("attachment")
        attachment_name = data.get("attachment_name")
        attachment_type = data.get("attachment_type")

        if not mylib.validate_json_input(data, ["recipient", "subject", "body"]):
            return jsonify({"error": "All fields (recipient, subject, body) are required"}), 400

        response = mylib.send_email_via_ses(recipient, subject, body, body_type, attachment, attachment_name, attachment_type)
        return jsonify({"message": "Email sent successfully", "response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_retirement_soa', methods=['POST'])
def get_retirement_soa():
    if not request.is_json:
        return jsonify({"error": "Invalid input: JSON data expected"}), 400

    data = request.get_json()
    required_fields = ["current_age", "retirement_income_goal", "risk_tolerance"]
    if not mylib.validate_json_input(data, required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_data = [
        data.get('name'),
        data.get('contact_number'),
        data.get('email_address'),
        data.get('current_age'),
        data.get('retirement_age'),
        data.get('comfortable_retirement_lifestyle'),
        data.get('retirement_income_goal'),
        data.get('current_superannuation_balance'),
        data.get('superannuation_investment'),
        data.get('additional_savings'),
        data.get('voluntary_super_contributions'),
        data.get('other_sources_of_income'),
        data.get('monthly_living_expenses'),
        data.get('buffer_for_unexpected_expenses'),
        data.get('preferred_retirement_income_type'),
        data.get('risk_tolerance'),
        data.get('growth_or_stability'),
        data.get('conservative_or_growth_approach'),
        data.get('ongoing_financial_advice'),
        data.get('review_frequency'),
        data.get('aged_care_planning'),
        data.get('eligibility_age_pension'),
        data.get('awareness_tax_implications'),
        data.get('minimize_tax'),
        data.get('valid_will_estate_plan'),
        data.get('beneficiaries_superannuation'),
        data.get('existing_insurance_policies'),
        data.get('concerns_aged_care_medical_expenses'),
        data.get('risk_tolerance_investments'),
        current_datetime
    ]

    mylib.append_to_google_sheet("leads", "Sheet1", sheet_data)

    customer_details = {key: data.get(key) for key in data}
    analysis = mylib.retirementAdvisor(customer_details)

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
            {''.join(f'<p><strong>{key}:</strong> {value}</p>' for key, value in customer_details.items() if value)}
            <p><strong>Date and Time:</strong> {current_datetime}</p>
        </div>
        <div class="analysis">
            <h1>Financial Analysis</h1>
            {analysis}
        </div>
    </body>
    </html>
    """

    try:
        response = mylib.send_email_via_ses("info@advicegenie.com.au", f"Retirement SOA for {data.get('current_age')}-year-old", email_body, "html")
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_soi', methods=['POST'])
def get_soi():
    if not request.is_json:
        return jsonify({"error": "Invalid input: JSON data expected"}), 400

    data = request.get_json()
    required_fields = ["fullName", "email", "phone", "age", "annualIncome", "dependents", "debts", "survivalMonths", "occupation", "medicalConditions", "smokeDrink", "insuranceType", "healthCoverage", "monthlyPremium"]
    if not mylib.validate_json_input(data, required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_data = [
        data.get('fullName'),
        data.get('email'),
        data.get('phone'),
        data.get('age'),
        data.get('annualIncome'),
        data.get('dependents'),
        data.get('debts'),
        data.get('survivalMonths'),
        data.get('occupation'),
        data.get('medicalConditions'),
        data.get('smokeDrink'),
        data.get('insuranceType'),
        data.get('healthCoverage'),
        data.get('monthlyPremium'),
        data.get('existingPolicies'),
        data.get('payoutPreference'),
        current_datetime
    ]

    mylib.append_to_google_sheet("leads", "Sheet1", sheet_data)

    customer_details = {key: data.get(key) for key in data}
    analysis = mylib.insuranceAdvice(customer_details)

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
            {''.join(f'<p><strong>{key}:</strong> {value}</p>' for key, value in customer_details.items() if value)}
            <p><strong>Date and Time:</strong> {current_datetime}</p>
        </div>
        <div class="analysis">
            <h1>Insurance Analysis</h1>
            {analysis}
        </div>
    </body>
    </html>
    """

    try:
        response = mylib.send_email_via_ses("info@advicegenie.com.au", f"Statement of Insurance for {data.get('fullName')}", email_body, "html")
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/update_leads', methods=['POST'])
def update_leads():
    if not request.is_json:
        return jsonify({"error": "Invalid input: JSON data expected"}), 400

    data = request.get_json()
    required_fields = ["fullName", "email", "phone", "age", "financialGoal", "investmentAmount", "riskTolerance"]
    if not mylib.validate_json_input(data, required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_data = [
        data.get('fullName'),
        data.get('email'),
        data.get('phone'),
        data.get('age'),
        data.get('financialGoal'),
        data.get('investmentAmount'),
        data.get('riskTolerance'),
        current_datetime
    ]

    mylib.append_to_google_sheet("leads", "Sheet1", sheet_data)

    customer_details = {key: data.get(key) for key in data}
    analysis = mylib.financialAdvisor(customer_details)

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
            {''.join(f'<p><strong>{key}:</strong> {value}</p>' for key, value in customer_details.items() if value)}
            <p><strong>Date and Time:</strong> {current_datetime}</p>
        </div>
        <div class="analysis">
            <h1>Financial Analysis</h1>
            {analysis}
        </div>
    </body>
    </html>
    """

    try:
        response = mylib.send_email_via_ses("info@advicegenie.com.au", f"Statement of Advice for {data.get('fullName')}", email_body, "html")
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/onboard_advisors", methods=["POST"])
def onboard_advisors():
    try:
        if not request.is_json:
            return jsonify({"error": "Invalid input: JSON data expected"}), 400

        data = request.get_json()
        required_fields = ["name", "phone", "email", "afsl", "businessName", "businessAddress", "businessURL", "agreement1", "agreement2"]
        if not mylib.validate_json_input(data, required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        if not (data.get('agreement1') and data.get('agreement2')):
            return jsonify({"error": "You must agree to both the engagement and privacy terms"}), 400

        current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sheet_data = [
            data.get('name'),
            data.get('phone'),
            data.get('email'),
            data.get('afsl'),
            data.get('businessName'),
            data.get('businessAddress'),
            data.get('businessURL'),
            data.get('agreement1'),
            data.get('agreement2'),
            current_datetime
        ]

        mylib.append_to_google_sheet("leads", "Sheet2", sheet_data)

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
                {''.join(f'<p><strong>{key}:</strong> {value}</p>' for key, value in data.items() if value)}
                <p><strong>Date and Time:</strong> {current_datetime}</p>
            </div>
        </body>
        </html>
        """

        response = mylib.send_email_via_ses("info@advicegenie.com.au", f"New Advisor Onboarding: {data.get('name')}", email_body, "html")
        return jsonify({"message": "Advisor onboarding data received and processed", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"message": "Flask app is running"}), 200

@app.route('/multiply', methods=['POST'])
def multiply():
    try:
        data = request.get_json()
        a = float(data.get('a'))
        b = float(data.get('b'))
        result = a * b
        return jsonify({'result': result}), 200
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid input. Please provide numerical values for a and b.'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)