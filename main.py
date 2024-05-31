from flask import Flask, render_template, request, redirect, url_for, session
import mylib
import json

app = Flask(__name__)
app.secret_key = 'abc123e'
init = 'yes'
message_json = [] 

student = {
    "country": "Australia",
    "state": "NSW",
    "year": 10,
    "subject": "Science",
    "term": "term I",
    "subarea" : "Forces",
    "difficulty": "4"
}

@app.route('/')
def home():
    session.clear()
    return render_template('index.html')

@app.route('/login',methods=['GET','POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    

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
