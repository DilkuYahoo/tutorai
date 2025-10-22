import json
import random

# ---- Load questions from JSON file ----
with open("data/1984_vocab.json", "r") as file:
    data = json.load(file)

questions = data["questions"]

score = 0
total = len(questions)

print("\n📘 Welcome to the '1984' Vocabulary Booster Quiz!\n")
print("You'll be asked random questions based on George Orwell's '1984'.")
print("Type the letter (A, B, C, or D) for your answer.\n")

# ---- Shuffle and ask ----
random.shuffle(questions)

for i, q in enumerate(questions, 1):
    print(f"Q{i}. {q['question']}")
    print(f"   Context: {q['context']}")
    print(f"   Word: {q['word']}")
    print()

    options = q["options"]
    random.shuffle(options)

    for idx, opt in enumerate(options):
        print(f"   {chr(65 + idx)}. {opt}")

    user_answer = input("\nYour answer: ").strip().upper()

    # Validate input
    if user_answer not in ['A', 'B', 'C', 'D']:
        print("⚠️  Invalid choice! Please enter A, B, C, or D.\n")
        continue

    # Determine correctness
    correct_option = chr(65 + options.index(q["answer"]))
    if options[ord(user_answer) - 65] == q["answer"]:
        print("✅ Correct!\n")
        score += 1
    else:
        print(f"❌ Incorrect. The correct answer was {correct_option}: {q['answer']}\n")

# ---- Final Score ----
print("📊 Quiz Complete!")
print(f"Your Score: {score}/{total}")
percent = (score / total) * 100
print(f"Accuracy: {percent:.1f}%\n")

if percent == 100:
    print("🏆 Perfect! You’ve mastered the vocabulary of '1984'!")
elif percent >= 70:
    print("🎯 Great job! You have a strong command of the book’s vocabulary.")
else:
    print("📚 Keep practicing! Review the context to strengthen your understanding.")
