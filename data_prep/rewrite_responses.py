
#!/usr/bin/env python3
# Rewrites each 'input_text' in processed_input_text.csv using OpenAI, outputs JSON: {"index": <index>, "rewritten_input_text": <input_text>}

import os, json, sys
import pandas as pd
from dotenv import load_dotenv
from openai import AzureOpenAI

# ============== .env & client setup ==============

load_dotenv(".azure/Personas/.env")

api_key = os.getenv("AZURE_OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("Missing OPENAI_API_KEY")
base_url = os.getenv("AZURE_OPENAI_ENDPOINT")
api_version = os.getenv("AZURE_OPENAI_API_VERSION")

client = AzureOpenAI(
    api_version=api_version,
    azure_endpoint=base_url,
    api_key=api_key,
)

print(f"AzureOpenAI endpoint: {client._azure_endpoint}", flush=True)
MODEL = os.getenv("AZURE_OPENAI_CHATGPT_MODEL", "gpt-4.1-mini")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "20"))
print(f"[info] Using model: {MODEL}, batch size: {BATCH_SIZE}", flush=True)
print(f"[info] API base URL: {base_url}", flush=True)
print(f"[info] API key present: {'yes' if api_key else 'no'}")


# ============== Read structured JSONs ==============
input_json_path = "data/input_datasets/structured_output.json"
print(f"[stage] Reading structured JSONs from: {input_json_path}", flush=True)
with open(input_json_path, "r", encoding="utf-8") as f:
    json_list = json.load(f)
print(f"[ok] Loaded {len(json_list)} JSON objects", flush=True)

# ============== OpenAI call (batched) ==============
SYSTEM_PROMPT = (
    "You are a meticulous survey editor in a batch-cleaning job.\n"
    "Language: EN. Rules:\n"
    "- Make grammar/spelling/casing/punctuation natural and concise (≤60 words unless original is longer).\n"
    "- Preserve meaning and tone. Do NOT add facts or change intent.\n"
    "- rewrite each response a a recount.\n"
    "- If input is effectively a non-answer (n/a/none/blank/\"idk\"/etc.), rewrite to: \"No specific feedback provided.\"\n"
    "- Return STRICT JSON only.\n"
)

USER_INSTR = (
    "Rewrite the following items.\n"
    "Input is a JSON array of objects with fields: idx (int), input_text (string).\n"
    "Return a JSON array of objects: {idx:int, rewritten_input_text:string} in the SAME ORDER as input.\n"
    "Rewrite each answer in the context of its input_text."
)

def _extract_json(s: str):
    try:
        return json.loads(s)
    except Exception:
        # Find first JSON-looking segment
        start = None
        for i,ch in enumerate(s):
            if ch in "[{":
                start = i; break
        if start is None:
            raise ValueError("no JSON bracket found")
        end = max(s.rfind("]"), s.rfind("}"))
        if end <= start:
            raise ValueError("no JSON end bracket found")
        snippet = s[start:end+1]
        snippet = snippet.strip()
        snippet = snippet.removeprefix("```json").removesuffix("```").strip()
        return json.loads(snippet)

def call_openai_batch(items):
    payload = json.dumps(items, ensure_ascii=False)
    resp = client.responses.create(
        model=MODEL,
        input=[
            {"role":"system","content":SYSTEM_PROMPT},
            {"role":"user","content":USER_INSTR},
            {"role":"user","content":payload},
        ],
        max_output_tokens=2000,
    )
    out_text = (getattr(resp, "output_text", None) or "").strip()
    if not out_text:
        raise RuntimeError("OpenAI returned empty output_text for batch.")
    obj = _extract_json(out_text)
    if not isinstance(obj, list):
        raise ValueError("Model did not return a JSON array.")
    out = []
    for rec in obj:
        if not isinstance(rec, dict): continue
        if "idx" in rec and "rewritten_input_text" in rec:
            out.append({"idx": int(rec["idx"]), "rewritten_input_text": str(rec["rewritten_input_text"])});
    return out


# ============== Prepare items for rewriting ==============
rewrite_items = []
for i, obj in enumerate(json_list):
    rewrite_items.append({"idx": obj["Id"], "input_text": obj["Description"]})


# ============== Batch rewriting and save per file ==============
data_dir = "data"
os.makedirs(data_dir, exist_ok=True)

for start in range(0, len(rewrite_items), BATCH_SIZE):
    batch = rewrite_items[start:start+BATCH_SIZE]
    try:
        results = call_openai_batch(batch)
    except Exception as e:
        print(f"[error] batch failed [{start}:{start+len(batch)}]: {e}", flush=True)
        continue
    for i, rec in enumerate(results):
        # Find the corresponding JSON object
        obj_idx = start + i
        obj = json_list[obj_idx]
        # Create a copy to avoid mutating the input list
        out_obj = dict(obj)
        out_obj["Description"] = rec["rewritten_input_text"]
        # Save as individual JSON file
        out_path = os.path.join(data_dir, f"file{out_obj['Id']}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out_obj, f, ensure_ascii=False, indent=2)
        print(f"[ok] Saved rewritten JSON to {out_path}")

print("[done] All JSONs rewritten and saved individually.", flush=True)