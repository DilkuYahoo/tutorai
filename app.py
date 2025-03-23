from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import mylib

app = Flask(__name__)
CORS(app)

# Routes
@app.route("/send-email", methods=["POST"])
def send_email():
    try:
        data = request.get_json()
        required_fields = ["recipient", "subject", "body"]
        if not mylib.validate_json_input(data, required_fields):
            return jsonify({"error": "All fields (recipient, subject, body) are required"}), 400

        response = mylib.send_email_via_ses(
            data["recipient"], data["subject"], data["body"], 
            data.get("body_type", "text"), data.get("attachment"), 
            data.get("attachment_name"), data.get("attachment_type")
        )
        return jsonify({"message": "Email sent successfully", "response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_retirement_soa', methods=['POST'])
def get_retirement_soa():
    data, error = mylib.validate_and_extract_data(request.get_json(), ["current_age", "retirement_income_goal", "risk_tolerance"])
    if error:
        return jsonify({"error": error}), 400

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_data = [data.get(key) for key in [
        'name', 'contact_number', 'email_address', 'current_age', 'retirement_age', 
        'comfortable_retirement_lifestyle', 'retirement_income_goal', 'current_superannuation_balance', 
        'superannuation_investment', 'additional_savings', 'voluntary_super_contributions', 
        'other_sources_of_income', 'monthly_living_expenses', 'buffer_for_unexpected_expenses', 
        'preferred_retirement_income_type', 'risk_tolerance', 'growth_or_stability', 
        'conservative_or_growth_approach', 'ongoing_financial_advice', 'review_frequency', 
        'aged_care_planning', 'eligibility_age_pension', 'awareness_tax_implications', 
        'minimize_tax', 'valid_will_estate_plan', 'beneficiaries_superannuation', 
        'existing_insurance_policies', 'concerns_aged_care_medical_expenses', 
        'risk_tolerance_investments'
    ]] + [current_datetime]

    customer_details = {key: data.get(key) for key in data}
    analysis = mylib.retirementAdvisor(customer_details)
    email_body = mylib.generate_email_body(
        "Customer Details", customer_details, "Financial Analysis", analysis, current_datetime
    )

    try:
        response = mylib.append_to_sheet_and_send_email(
            "leads", sheet_data, f"Retirement SOA for {data.get('current_age')}-year-old", email_body
        )
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_soi', methods=['POST'])
def get_soi():
    data, error = mylib.validate_and_extract_data(request.get_json(), [
        "fullName", "email", "phone", "age", "annualIncome", "dependents", "debts", 
        "survivalMonths", "occupation", "medicalConditions", "smokeDrink", "insuranceType", 
        "healthCoverage", "monthlyPremium"
    ])
    if error:
        return jsonify({"error": error}), 400

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_data = [data.get(key) for key in [
        'fullName', 'email', 'phone', 'age', 'annualIncome', 'dependents', 'debts', 
        'survivalMonths', 'occupation', 'medicalConditions', 'smokeDrink', 'insuranceType', 
        'healthCoverage', 'monthlyPremium', 'existingPolicies', 'payoutPreference'
    ]] + [current_datetime]

    customer_details = {key: data.get(key) for key in data}
    analysis = mylib.insuranceAdvice(customer_details)
    email_body = mylib.generate_email_body(
        "Customer Details", customer_details, "Insurance Analysis", analysis, current_datetime
    )

    try:
        response = mylib.append_to_sheet_and_send_email(
            "leads", sheet_data, f"Statement of Insurance for {data.get('fullName')}", email_body
        )
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/update_leads', methods=['POST'])
def update_leads():
    data, error = mylib.validate_and_extract_data(request.get_json(), [
        "fullName", "email", "phone", "age", "financialGoal", "investmentAmount", "riskTolerance"
    ])
    if error:
        return jsonify({"error": error}), 400

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_data = [data.get(key) for key in [
        'fullName', 'email', 'phone', 'age', 'financialGoal', 'investmentAmount', 'riskTolerance'
    ]] + [current_datetime]

    customer_details = {key: data.get(key) for key in data}
    analysis = mylib.financialAdvisor(customer_details)
    email_body = mylib.generate_email_body(
        "Customer Details", customer_details, "Financial Analysis", analysis, current_datetime
    )

    try:
        response = mylib.append_to_sheet_and_send_email(
            "leads", sheet_data, f"Statement of Advice for {data.get('fullName')}", email_body
        )
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/onboard_advisors", methods=["POST"])
def onboard_advisors():
    try:
        data, error = mylib.validate_and_extract_data(request.get_json(), [
            "name", "phone", "email", "afsl", "businessName", "businessAddress", 
            "businessURL", "agreement1", "agreement2"
        ])
        if error:
            return jsonify({"error": error}), 400

        if not (data.get('agreement1') and data.get('agreement2')):
            return jsonify({"error": "You must agree to both the engagement and privacy terms"}), 400

        current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sheet_data = [data.get(key) for key in [
            'name', 'phone', 'email', 'afsl', 'businessName', 'businessAddress', 
            'businessURL', 'agreement1', 'agreement2'
        ]] + [current_datetime]

        email_body = mylib.generate_email_body(
            "New Advisor Onboarding", data, "Advisor Details", "", current_datetime
        )

        response = mylib.append_to_sheet_and_send_email(
            "leads", sheet_data, f"New Advisor Onboarding: {data.get('name')}", email_body
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