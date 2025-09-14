import os
import re

project_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(project_dir, ".env")

env_vars = set()
pattern = re.compile(r"os\.getenv\(\s*[\"']([\w\-]+)[\"']")

for root, _, files in os.walk(project_dir):
    for file in files:
        if file.endswith(".py"):
            with open(os.path.join(root, file), "r", encoding="utf-8") as f:
                for line in f:
                    for match in pattern.findall(line):
                        env_vars.add(match)

# Read existing .env to avoid duplicates
existing = set()
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                existing.add(line.split("=")[0].strip())

# Write missing env vars to .env
with open(env_path, "a", encoding="utf-8") as f:
    for var in sorted(env_vars):
        if var not in existing:
            f.write(f"{var}=\n")

print(f"Added {len(env_vars - existing)} new env vars to .env")