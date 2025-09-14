#!/usr/bin/env python3
# rewrite_responses.py
# Column-wise batched rewrite using OpenAI Responses API (gpt-5-nano)
# - Downloads XLSX from Azure
# - Detects free-text columns (skips categorical)
# - Quality-gates per cell; only low-quality go to the model
# - Batches per column with robust JSON extraction (no temperature/top_p)
# - Produces same-shape CSV/XLSX + Change Log; optional upload back to Azure

import os, io, time, random, json, re, csv, sys, math, statistics
from typing import List, Dict, Any, Callable, Tuple, Optional
import pandas as pd

from dotenv import load_dotenv, find_dotenv
from azure.storage.blob import BlobServiceClient

# OpenAI Responses API
from openai import OpenAI
from openai import APIError, APIStatusError, AuthenticationError, RateLimitError

# ---- Optional quality deps ----
try:
    import language_tool_python
except Exception:
    language_tool_python = None
try:
    import textstat
except Exception:
    textstat = None

# ============== .env & client setup ==============
dotenv_path = find_dotenv()
if not dotenv_path:
    raise RuntimeError("Could not locate a .env file in project root.")
load_dotenv(dotenv_path)
print(f"[env] Loaded .env from: {dotenv_path}", flush=True)

def _has(k: str) -> str: return "FOUND" if os.getenv(k) else "MISSING"
print("[env] Keys status:")
for k in ["AZURE_STORAGE_CONNECTION_STRING","AZURE_CONTAINER_NAME","DATASET_FILE_NAME",
          "OPENAI_API_KEY","OPENAI_BASE_URL","OPENAI_MODEL","TARGET_LANG","ONE_BATCH_ONLY","BATCH_SIZE"]:
    print(f"  {k:26}: {_has(k)}", flush=True)

api_key = os.getenv("OPENAI_API_KEY")
base_url = os.getenv("OPENAI_BASE_URL")
if not api_key:
    raise RuntimeError("Missing OPENAI_API_KEY")
client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI()

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")   # Nano works with Responses API (not Assistants)
TARGET_LANG = (os.getenv("TARGET_LANG") or "EN").upper()
ONE_BATCH_ONLY = (os.getenv("ONE_BATCH_ONLY","0").lower() in ("1","true","yes","on"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "60"))    # keep small; safer for JSON round-trips

# ============== retry helpers ==============
def _sleep_backoff(attempt: int, base: float = 0.9, cap: float = 8.0) -> None:
    delay = min(cap, base * (2 ** max(0, attempt - 1))) + random.random() * 0.25
    print(f"[retry] sleeping {delay:.2f}s before retry #{attempt+1} ...", flush=True)
    time.sleep(delay)

def retry_call(fn: Callable, *, attempts: int = 3, exceptions: Tuple[type, ...] = (Exception,), desc: str = ""):
    last = None
    for i in range(attempts):
        try:
            return fn()
        except exceptions as e:
            last = e
            print(f"[retry] {desc or fn.__name__} failed on attempt {i+1}/{attempts}: {e}", flush=True)
            if i < attempts - 1:
                _sleep_backoff(i + 1)
            else:
                print(f"[retry] giving up after {attempts} attempts.", flush=True)
                raise
    raise last  # not reached

# ============== Azure: download XLSX ==============
connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
container_name = os.getenv("AZURE_CONTAINER_NAME")
blob_name = os.getenv("DATASET_FILE_NAME") or "input.xlsx"
if not connection_string or not container_name:
    raise RuntimeError("Missing Azure settings: AZURE_STORAGE_CONNECTION_STRING, AZURE_CONTAINER_NAME.")

print(f"[azure] connecting BlobServiceClient (container={container_name})", flush=True)
blob_service = BlobServiceClient.from_connection_string(conn_str=connection_string)
container_client = blob_service.get_container_client(container_name)
blob_client = container_client.get_blob_client(blob_name)

print(f"[stage] Downloading blob '{blob_name}' ...", flush=True)
def _download_blob_bytes() -> bytes:
    return blob_client.download_blob().readall()
xlsx_bytes = retry_call(_download_blob_bytes, attempts=4, desc=f"download_blob({blob_name})")

local_input = os.getenv("LOCAL_INPUT_XLSX","input.xlsx")
with open(local_input,"wb") as f:
    f.write(xlsx_bytes)
print(f"[ok] Downloaded to ./{local_input} ({len(xlsx_bytes)} bytes)", flush=True)

# ============== Read DataFrame ==============
print("[stage] Reading Excel into DataFrame ...", flush=True)
df = pd.read_excel(local_input)
print(f"[ok] DataFrame loaded: shape={df.shape}", flush=True)

# ============== Column normalization ==============
def _normalize_colname(c: str) -> str:
    c = (c or "").strip()
    c = re.sub(r"\s+", " ", c)
    c = re.sub(r"[ \t]+$", "", c)
    return c

orig_to_norm = {c: _normalize_colname(str(c)) for c in df.columns}
norm_to_orig = {v:k for k,v in orig_to_norm.items()}
df.columns = [orig_to_norm[c] for c in df.columns]
print(f"[stage] Normalizing column names ...", flush=True)
print(f"[ok] Normalized {len(df.columns)} columns.", flush=True)

# ============== Detect free-text columns (skip categorical) ==============
def _is_object_or_string(s: pd.Series) -> bool:
    return s.dtype == object or pd.api.types.is_string_dtype(s.dtype)

def _alpha_ratio(text: str) -> float:
    t = (text or "")
    if not isinstance(t,str): t=str(t)
    letters = sum(ch.isalpha() for ch in t)
    total   = len(t)
    return (letters/total) if total else 0.0

def _token_count(text: str) -> int:
    if not isinstance(text,str): text=str(text)
    return len(re.findall(r"[A-Za-z0-9’'_-]+", text))

def detect_free_text_columns(df: pd.DataFrame, sample_n: int = 200) -> List[str]:
    cols = []
    nrows = len(df)
    for col in df.columns:
        s = df[col]
        if not _is_object_or_string(s):
            continue

        # basic NA cleanup
        sample = s.dropna().astype(str)
        if sample.empty:
            continue

        # categorical skip: low unique ratio or top-5 values cover most rows
        unique_ratio = sample.nunique(dropna=True) / max(1, len(sample))
        topk_freq = sample.value_counts(normalize=True).head(5).sum()

        # text-ish heuristics on a sample
        smp = sample.sample(min(sample_n, len(sample)), random_state=42)
        alpha = statistics.fmean(_alpha_ratio(x) for x in smp) if len(smp) else 0.0
        mean_tokens = statistics.fmean(_token_count(x) for x in smp) if len(smp) else 0.0

        # keep if it looks like text, not a menu/choice
        if unique_ratio > 0.35 and topk_freq < 0.75 and (alpha > 0.45 or mean_tokens > 3.0):
            cols.append(col)
    return cols

candidate_cols = detect_free_text_columns(df)
print(f"[detect] candidate free-text columns: {len(candidate_cols)}", flush=True)

if ONE_BATCH_ONLY and candidate_cols:
    candidate_cols = candidate_cols[:5]
    print(f"[mode] ONE_BATCH_ONLY: limiting to first 5 text-like columns => {candidate_cols}", flush=True)

# ============== Quality gate (short-circuit) ==============
TARGET_LANG = TARGET_LANG
MIN_TEXT_LEN = int(os.getenv("MIN_TEXT_LEN", "20"))
MAX_GRAMMAR_ERR_RATE = float(os.getenv("MAX_GRAMMAR_ERR_RATE", "0.15"))
MIN_FRE_SCORE = float(os.getenv("MIN_FRE_SCORE", "30"))
OFF_TOPIC_MIN_SIM = float(os.getenv("OFF_TOPIC_MIN_SIM", "0.35"))
LT_LANG = os.getenv("LT_LANG", "en-US")

LT = None
if language_tool_python is not None:
    try:
        LT = language_tool_python.LanguageTool(LT_LANG, config={
            "maxTextLength": int(os.getenv("LT_MAX_TEXT_LENGTH", "2000")),
            "maxCheckTimeMillis": int(os.getenv("LT_MAX_CHECK_MS", "1500")),
        })
        print(f"[lt] LanguageTool ready: {LT_LANG}", flush=True)
    except Exception as e:
        print(f"[lt][warn] could not init LanguageTool: {e}", flush=True)

_WORD_RE = re.compile(r"[A-Za-z\u0590-\u05FF\u0600-\u06FF0-9']+", re.UNICODE)
def _tokenize(s: str) -> List[str]:
    return _WORD_RE.findall((s or "").lower())
def _jaccard(a: str, b: str) -> float:
    A, B = set(_tokenize(a)), set(_tokenize(b))
    if not A or not B: return 0.0
    return len(A & B) / max(1, len(A | B))

def _grammar_error_rate(text: str) -> float:
    if not text.strip() or LT is None:
        return 0.0
    try:
        matches = LT.check(text)
        tok = max(1, len(_tokenize(text)))
        return len(matches) / tok
    except Exception:
        return 0.0

def _flesch(text: str) -> float:
    try:
        if textstat is None: return 100.0
        return float(textstat.flesch_reading_ease(text))
    except Exception:
        return 100.0

def _is_nonanswer(text: str) -> bool:
    return bool(re.match(r"^\s*(n/?a|none|nothing|no\s+idea|idk|not\s+sure|no comment)\s*$", str(text or ""), re.I))

def _is_noisy(text: str) -> bool:
    t = str(text or "")
    if not t: return False
    if t.isupper() and len(t) >= 6: return True
    if re.search(r"(.)\1{3,}", t):  # repeated chars
        return True
    if re.search(r"[😅😂🤣🙃🤪😍❤️⭐✨🔥💯]{3,}", t):
        return True
    return False

def should_rewrite(header: str, answer: str) -> Tuple[bool, str]:
    """Return (needs, reason). Any single condition triggers."""
    text = (answer or "").strip()
    if text == "": return False, ""  # keep empty cells unchanged (not 'normalize to sentence' here)
    if len(text) < MIN_TEXT_LEN or _is_nonanswer(text): return True, "short_or_nonanswer"
    if _is_noisy(text): return True, "noisy"
    if header and _jaccard(header, text) < OFF_TOPIC_MIN_SIM: return True, "off_topic"
    erate = _grammar_error_rate(text)
    if erate > MAX_GRAMMAR_ERR_RATE: return True, f"grammar_density={erate:.2f}"
    fre = _flesch(text)
    if fre < MIN_FRE_SCORE: return True, f"flesch={fre:.1f}"
    return False, ""

# ============== OpenAI call (batched) ==============
# We avoid responses.parse and force JSON via instructions; then robustly extract.
SYSTEM_PROMPT = (
    "You are a meticulous survey editor in a batch-cleaning job.\n"
    f"Language: {TARGET_LANG}. Rules:\n"
    "- Make grammar/spelling/casing/punctuation natural and concise (≤60 words unless original is longer).\n"
    "- Preserve meaning and tone. Do NOT add facts or change intent.\n"
    "- If input is effectively a non-answer (n/a/none/blank/\"idk\"/etc.), rewrite to: \"No specific feedback provided.\"\n"
    "- Return STRICT JSON only.\n"
)

USER_INSTR = (
    "Rewrite the following items.\n"
    "Input is a JSON array of objects with fields: idx (int), header (string), text (string).\n"
    "Return a JSON array of objects: {idx:int, new_text:string} in the SAME ORDER as input.\n"
    "Only modify items that require changes; for good items, return the original text unchanged.\n"
)

def _extract_json(s: str) -> Any:
    """Robustly extract JSON array/object from a string."""
    if not s: raise ValueError("empty output_text")
    # Try direct
    try:
        return json.loads(s)
    except Exception:
        pass
    # Find first JSON-looking segment
    start = None
    for i,ch in enumerate(s):
        if ch in "[{":
            start = i; break
    if start is None:
        raise ValueError("no JSON bracket found")
    # Heuristic: find matching end by last ] or }
    end = max(s.rfind("]"), s.rfind("}"))
    if end <= start:
        raise ValueError("no JSON end bracket found")
    snippet = s[start:end+1]
    # Attempt cleanups for trailing commas / code fences
    snippet = snippet.strip()
    snippet = snippet.removeprefix("```json").removesuffix("```").strip()
    return json.loads(snippet)

def call_openai_batch(col_header: str, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    items: [{idx:int, header:str, text:str}]
    returns: [{idx:int, new_text:str}]
    """
    payload = json.dumps(items, ensure_ascii=False)
    def _do():
        resp = client.responses.create(
            model=MODEL,
            input=[
                {"role":"system","content":SYSTEM_PROMPT},
                {"role":"user","content":USER_INSTR},
                {"role":"user","content":f"Column header context: {col_header}"},
                {"role":"user","content":payload},
            ],
            max_output_tokens=2000,   # keep moderate; we batch small
        )
        # Prefer output_text; fall back to concatenating content parts if needed
        out_text = (getattr(resp, "output_text", None) or "").strip()
        if not out_text:
            # Concatenate all text fragments (defensive)
            try:
                parts = []
                for block in (getattr(resp, "output", []) or []):
                    for c in getattr(block, "content", []) or []:
                        t = getattr(c, "text", None)
                        if t and getattr(t, "value", ""):
                            parts.append(t.value)
                out_text = "\n".join(parts).strip()
            except Exception:
                pass
        if not out_text:
            raise RuntimeError("OpenAI returned empty output_text for batch.")
        obj = _extract_json(out_text)
        if not isinstance(obj, list):
            raise ValueError("Model did not return a JSON array.")
        # Validate basic shape
        out = []
        for rec in obj:
            if not isinstance(rec, dict): continue
            if "idx" in rec and "new_text" in rec:
                out.append({"idx": int(rec["idx"]), "new_text": str(rec["new_text"])})
        if len(out) != len(items):
            # try to map by presence; still return what we have
            print(f"[warn] batch size mismatch: sent={len(items)} got={len(out)}", flush=True)
        return out
    return retry_call(_do, attempts=3,
                      exceptions=(APIError, APIStatusError, AuthenticationError, RateLimitError, Exception),
                      desc="responses.create(batch)")

# ============== Process per column ==============
df_out = df.copy(deep=True)
change_log: List[Dict[str, Any]] = []

print("[stage] Rewriting per column (batched) ...", flush=True)
for col in candidate_cols:
    col_header = str(col)
    series = df[col].astype(object)

    # Build list of indices needing rewrite
    need_idxs: List[int] = []
    reasons_map: Dict[int, str] = {}
    for i, val in series.items():
        text = "" if pd.isna(val) else str(val)
        needs, reason = should_rewrite(col_header, text)
        if needs:
            need_idxs.append(i)
            reasons_map[i] = reason

    total_need = len(need_idxs)
    if total_need == 0:
        print(f"[column] '{col_header}': nothing to rewrite", flush=True)
        continue

    print(f"[column] '{col_header}': {total_need} rows need rewrite", flush=True)

    # Batch items
    for start in range(0, total_need, BATCH_SIZE):
        batch_idxs = need_idxs[start:start+BATCH_SIZE]
        items = [{"idx": int(i), "header": col_header, "text": "" if pd.isna(series.at[i]) else str(series.at[i])}
                 for i in batch_idxs]

        try:
            results = call_openai_batch(col_header, items)
        except Exception as e:
            print(f"[error] batch failed for column '{col_header}' [{start}:{start+len(batch_idxs)}]: {e}", flush=True)
            # Per-item fallback
            results = []
            for it in items:
                single_payload = [{"idx": it["idx"], "header": it["header"], "text": it["text"]}]
                try:
                    r1 = call_openai_batch(col_header, single_payload)
                    results.extend(r1)
                except Exception as e2:
                    print(f"[error] single-item fallback failed idx={it['idx']}: {e2}", flush=True)

        # Apply results
        for rec in results or []:
            idx = rec["idx"]
            old_text = "" if pd.isna(series.at[idx]) else str(series.at[idx])
            new_text = rec.get("new_text", old_text)
            if new_text != old_text:
                df_out.at[idx, col] = new_text
                change_log.append({
                    "RowIndex": int(idx),
                    "ColumnName": col_header,
                    "Old": old_text,
                    "New": new_text,
                    "Reasons": reasons_map.get(idx, ""),
                })

    if ONE_BATCH_ONLY:
        print("[mode] ONE_BATCH_ONLY — stopping after first processed column.", flush=True)
        break

# ============== Save outputs (local + Azure optional) ==============
out_same_shape_csv = os.getenv("LOCAL_SAME_SHAPE_CSV_NAME", "rewritten_same_shape.csv")
out_same_shape_xlsx = os.getenv("LOCAL_SAME_SHAPE_XLSX_NAME", "rewritten_same_shape.xlsx")
out_changes_csv = os.getenv("LOCAL_CHANGES_CSV", "rewrite_changes.csv")
out_changes_json = os.getenv("LOCAL_CHANGES_JSON", "rewrite_changes.json")

print(f"[stage] Writing same-shape CSV → ./{out_same_shape_csv}", flush=True)
df_out.to_csv(out_same_shape_csv, index=False)
print(f"[stage] Writing same-shape XLSX → ./{out_same_shape_xlsx}", flush=True)
df_out.to_excel(out_same_shape_xlsx, index=False)

print(f"[stage] Writing Change Log CSV → ./{out_changes_csv}", flush=True)
with open(out_changes_csv, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["RowIndex","ColumnName","Old","New","Reasons"])
    writer.writeheader()
    for row in change_log:
        writer.writerow(row)

print(f"[stage] Writing Change Log JSON → ./{out_changes_json}", flush=True)
with open(out_changes_json, "w", encoding="utf-8") as f:
    json.dump(change_log, f, ensure_ascii=False, indent=2)

# Optional re-upload to Azure
def _upload_local(path: str, dest_blob: str):
    bc = container_client.get_blob_client(dest_blob)
    with open(path, "rb") as f:
        bc.upload_blob(f, overwrite=True)
    print(f"[azure] uploaded output: {dest_blob}", flush=True)

try:
    if os.getenv("UPLOAD_SAME_SHAPE","1").lower() in ("1","true","yes","on"):
        _upload_local(out_same_shape_csv, os.getenv("OUTPUT_SAME_SHAPE_BLOB_NAME","rewritten_same_shape.csv"))
    if os.getenv("UPLOAD_CHANGES","1").lower() in ("1","true","yes","on"):
        _upload_local(out_changes_csv, os.getenv("OUTPUT_CHANGES_BLOB_CSV","rewrite_changes.csv"))
        _upload_local(out_changes_json, os.getenv("OUTPUT_CHANGES_BLOB_JSON","rewrite_changes.json"))
except Exception as e:
    print(f"[azure][warn] Failed uploading outputs: {e}", flush=True)

print("[done] Column-wise batched pipeline finished.", flush=True)