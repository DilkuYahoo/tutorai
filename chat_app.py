from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

app = Flask(__name__)
CORS(app)

# Global variable to store conversation history
conversation_history = [
    {"role": "system", "content": "You are a helpful question master, generate related question that gradually increase the difficulty level based on the feedback."}
]

def generate_question():
    global conversation_history
    
    prompt = (
        "Generate a english words to increase the vocabiliry, the question that has **not already been asked**, "
        "and make sure it's different from previous ones. "
        "The topic can be science, math, geography, or history. Return only the question."
    )
    
    # Add the user's prompt to the history
    conversation_history.append({"role": "user", "content": prompt})
    
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=conversation_history,
        max_tokens=100,
        temperature=0.7
    )
    
    question = response.choices[0].message.content.strip()
    
    # Add the assistant's response to the history
    conversation_history.append({"role": "assistant", "content": question})
    
    return question

def evaluate_answer_with_gpt(question, user_answer):
    prompt = (
        f"Question: {question}\n"
        f"User Answer: {user_answer}\n\n"
        "Is the user's answer correct? Reply with a short response (1-2 sentences) and be friendly. "
        "If it's incorrect, explain briefly why."
    )

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "You are an encouraging quiz evaluator who gives kind and constructive feedback."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=100,
        temperature=0.7
    )
    return response.choices[0].message.content.strip()

@app.route("/api/ask-question", methods=["POST"])
def ask_question():
    try:
        question = generate_question()
        return jsonify({"question": question})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/evaluate-answer", methods=["POST"])
def evaluate_answer():
    data = request.get_json()
    question = data.get("question")
    answer = data.get("answer")

    if not question or not answer:
        return jsonify({"error": "Missing question or answer"}), 400

    try:
        evaluation = evaluate_answer_with_gpt(question, answer)
        return jsonify({"evaluation": evaluation})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)