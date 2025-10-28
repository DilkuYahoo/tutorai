import json, random

# Load the JSON file
file_path = "elegy_at_18_poem.json"
with open(file_path, "r") as f:
    data = json.load(f)

# Randomize the position of the correct answer in each question
for q in data["questions"]:
    correct = q["answer"]
    options = q["options"]
    random.shuffle(options)
    q["options"] = options

# Save the randomized version
output_path = "elegy_at_18_poem1.json"
with open(output_path, "w") as f:
    json.dump(data, f, indent=2)

output_path
