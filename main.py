from flask import Flask, render_template, request, redirect, url_for, session
import mylib
import json

app = Flask(__name__)
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

@app.route('/')
def home():
    session.clear()
    return render_template('index.html')


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
    app.run(host="127.0.0.1", port="8080", debug=True)
