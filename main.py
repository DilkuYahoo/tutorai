from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import mylib
import json
from flask_cors import CORS
import hashlib

app = Flask(__name__)
CORS(app)

app.secret_key = 'abc123e'
init = 'yes'
message_json = [] 

student = {
    "name":"Kav",
    "country": "Australia",
    "state": "NSW",
    "year": 7,
    "subject": "maths",
    "term": "term I",
    "subject" : "Maths",
    "specialist_area" : "extension 2",
    "difficulty": "4"
}



@app.route('/gen_share_portfolio', methods=['POST'])
def ger_share_portfolio():
    input_data = request.json
    combined_data = mylib.financialAdvisor(input_data)
    return jsonify({"result": combined_data})

@app.route('/api/submit', methods=['POST'])
def submit_form():
    # Validate JSON input
    if not request.is_json:
        return jsonify({"error": "Invalid input: JSON data expected"}), 400

    data = request.get_json()

    # Extract the required fields from JSON data
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not name or not email or not message:
        return jsonify({"error": "Missing required fields"}), 400

    # Get Google Sheet instance
    sheet = mylib.get_google_sheet()

    # Append row data to Google Sheet
    sheet.append_row([name, email, message])

    return jsonify({"message": "Data successfully added to Google Sheet"}), 200



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

@app.route('/')
def home():
    session.clear()
    return render_template('index.html')

@app.route('/ticker_tracker')
def ticker_tracker():
    return render_template('ticker_tracker.html')

@app.route('/ticker_analysis', methods=['GET','POST'])
def ticker_analysis():
    #session.clear()
    #ticker = 'RRL.AX'
    ticker = request.form['ticker'].rstrip()
    exchange = request.form['exchange'].rstrip()
    analyse = request.form['analyse'].rstrip()
    ticker = f"{ticker}{exchange}"
    output = ""
    stock_data = mylib.fetch_stock_data(ticker=ticker)
    headlines = mylib.fetch_news_headlines(ticker)
    # Fetch stock data
    if not stock_data.empty:
        if analyse == 'sentiment':
            output = mylib.analyze_stock_sentiment(headlines)
        else:
            output = mylib.analyze_data(stock_data=stock_data)
        #message = mylib.analyze_data(stock_data=stock_data)
        #headlines = mylib.fetch_news_headlines(ticker)
        #sentiment_score = mylib.analyze_stock_sentiment(headlines)
        #message = f"{message} <br> <br> {sentiment_score}"
    return render_template('ticker_analysis.html',message=output)

@app.route('/login')
def login():
    session.clear()
    return render_template('login.html')


@app.route('/dashboard',methods=['GET','POST'])
def dashboard():
    student["name"] = request.form['name']
    student["year"] = request.form['year']
    student["subject"] = request.form['subject']
    student["specialist_area"] = request.form['specialist_area']
    student["difficulty"] = request.form['difficulty']
    return render_template('dashboard.html',validation=student)


@app.route('/generateQ')
def generateQ():
    # Check if 'init' key exists in the session
    if 'init' in session:
        init = session['init']
    else:
        init = 'yes'  # Set to 'no' if not found

    question, message = mylib.generateQ(init=init, message=message_json, student=student)
    #question = f"values of init {init}"
    #message = 'This is the experiment message'
    session['init'] =  'no' # Set to 'no' for future requests
    session['message'] = message
    return render_template('PostLoginQuestion.html',question=question)

@app.route('/validateQ',methods=['GET','POST'])
def validateQ():
    #read the answer from textarea
    message = session['message']
    user_input = request.form.get('user_input')
    answer, message = mylib.validateAnw(message=message,answer=user_input)
    #answer = 'this is a experiment answer'
    session['message'] = message
    print (message)
    return render_template('validateQ.html', validation = answer)


if __name__ == '__main__':
    app.run(host="0.0.0.0", port="8080", debug=True)
