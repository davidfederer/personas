# %%
from azure.storage.blob import BlobServiceClient
import pandas as pd
import io
from dotenv import load_dotenv
import os
import openpyxl
import json

# %%
load_dotenv()  # Load environment variables from .env file
connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
container_name = os.getenv("AZURE_CONTAINER_NAME")
dataset_file_name = os.getenv("DATASET_FILE_NAME")

# %%
# Connect to your Azure Blob Storage
blob_service_client = BlobServiceClient.from_connection_string(connection_string)
container_client = blob_service_client.get_container_client(container_name)
blob_client = container_client.get_blob_client(dataset_file_name)

# Download the blob as bytes
excel_bytes = blob_client.download_blob().readall()

# Read into pandas directly from bytes
df = pd.read_excel(io.BytesIO(excel_bytes))


# %%
df = df.set_index('Come-back-Later Code?')
df = df.drop(columns=["Complete Type?", "Submitted Date?"])

# Step 1: Format each cell as a string with 'Question' and 'Answer' separated by a newline
df_transformed = df.apply(lambda col: col.apply(lambda val: {'Question': col.name, 'Answer': val}))

# Step 2: Rename columns to 'Q0', 'Q1', ...
df_transformed.columns = [f'Q{i}' for i in range(df.shape[1])]

# %%
from collections import defaultdict

def dataframe_to_grouped_json(df_transformed):
    grouped_json = defaultdict(list)

    for row_idx in df_transformed.index:
        for col_name in df_transformed.columns:
            cell = df_transformed.at[row_idx, col_name]
            if isinstance(cell, dict):
                answer = cell.get("Answer")
                if pd.notna(answer):  # Only include if Answer is not NaN
                    grouped_json[str(row_idx)].append({
                        "Survey_Question": col_name,
                        "Question": cell.get("Question"),
                        "Answer": answer
                    })

    return dict(grouped_json)

# %%
grouped_json = dataframe_to_grouped_json(df_transformed)


# %%
#for testing ONLY
first_key = next(iter(grouped_json))
reduced_dict = {first_key: grouped_json[first_key]}


# %%
reduced_dict

# %%
# # Optional: Save as JSON
# import json
# with open("grouped_output.json", "w") as f:
#     json.dump(grouped_json, f, indent=2)


# %%
import requests
api_url = os.getenv("HF_MODEL_ENDPOINT")
hf_access_token = os.getenv("HF_ACCESS_TOKEN")

# %%
import os, json, sys
from typing import Dict, Any
from dotenv import load_dotenv

from pydantic import BaseModel
from openai import OpenAI
from openai import APIStatusError, RateLimitError, APIError, AuthenticationError

load_dotenv()  # ensure OPENAI_* vars are loaded


class RewriteQA(BaseModel):
    Question: str
    Answer: str


def rewrite_qa(data: Dict[str, Any]) -> Dict[str, str]:
    """
    Rewrites the 'Question' and 'Answer' fields using OpenAI gpt-5-nano
    with structured outputs via Responses API + Pydantic parsing.
    """

    # --- auth
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")  # optional (proxy/self-host)
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY in environment.")
    client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)

    original_question = str(data.get("Question", "")).strip()
    original_answer   = str(data.get("Answer", "")).strip()

    # High-quality instructions
    system_prompt = (
        "You are a meticulous survey editor. "
        "Rewrite each survey item to be grammatically correct, concise, and natural while preserving the original meaning and tone. "
        "Remove filler and hedging, but keep the respondent's voice. "
        "Do not add or invent facts. "
        "Respond ONLY with JSON that matches the provided schema."
    )
    user_prompt = (
        "Rewrite the following survey item.\n\n"
        f"Question:\n{original_question}\n\n"
        f"Answer:\n{original_answer}\n\n"
        "Return JSON with keys exactly 'Question' and 'Answer'."
    )

    try:
        # Responses API + parse(): returns response.output_parsed (RewriteQA) when successful.
        # Use max_output_tokens with Responses API on GPT-5 models.
        response = client.responses.parse(
            model="gpt-5-nano",
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            text_format=RewriteQA,
            max_output_tokens=400,
        )

        parsed = response.output_parsed  # type: RewriteQA | None
        if parsed is None:
            # Fallback: try to get raw text and parse JSON manually
            raw = getattr(response, "output_text", "") or ""
            raw = raw.strip()
            if raw:
                try:
                    obj = json.loads(raw)
                    parsed = RewriteQA(**obj)  # validate structure
                except Exception:
                    pass  # fall through to safe fallback below

        if parsed is None:
            # Last-ditch safe fallback: keep originals and include short debug preview
            preview = (getattr(response, "output_text", "") or "")[:160].replace("\n", " ")
            raise RuntimeError(
                f"[rewrite_qa] No parsable JSON in Responses output. Preview: {preview!r}"
            )

        result = {
            "Survey_Question": data.get("Survey_Question", ""),
            "Question": parsed.Question.strip(),
            "Answer":   parsed.Answer.strip(),
        }

        # visible progress
        msg = f"[rewrite_qa] Rewrote Survey_Question {result['Survey_Question']} — edited 1 item."
        print(msg, flush=True)
        try:
            print(msg, file=sys.__stdout__, flush=True)
        except Exception:
            pass

        # sanity guard
        if not result["Question"]:
            result["Question"] = original_question
        if not result["Answer"]:
            result["Answer"] = original_answer

        return result

    except AuthenticationError as e:
        raise RuntimeError("[rewrite_qa] Auth error: check OPENAI_API_KEY.") from e
    except RateLimitError as e:
        raise RuntimeError("[rewrite_qa] Rate limited: back off or adjust plan.") from e
    except APIStatusError as e:
        status = getattr(e, "status_code", None)
        raise RuntimeError(f"[rewrite_qa] API status error ({status}): {e}") from e
    except APIError as e:
        raise RuntimeError(f"[rewrite_qa] API error: {e}") from e
    except Exception as e:
        raise RuntimeError(f"[rewrite_qa] Unexpected error: {type(e).__name__}: {e}") from e

# # %%
# sample_input =  {
#     'Survey_Question': 'Q6',
#     'Question': 'And how old is your child?   ',
#     'Answer': '16 years old'
# }

# rewritten_output = rewrite_qa(sample_input)
# print(rewritten_output)

# %%
rewritten_grouped_json = {}

print(reduced_dict)

for respondent_id, qa_list in reduced_dict.items():
    rewritten_qa_list = []
    
    for qa in qa_list:
        try:
            rewritten_qa = rewrite_qa(qa)
            rewritten_qa_list.append(rewritten_qa)
        except Exception as e:
            print(f"Error rewriting {qa.get('Survey_Question')} for respondent {respondent_id}: {e}")
            # Optionally include the original with an error message
            rewritten_qa_list.append({
                'Survey_Question': qa.get('Survey_Question'),
                'Question': qa.get('Question'),
                'Answer': qa.get('Answer'),
                'Error': str(e)
            })

    rewritten_grouped_json[respondent_id] = rewritten_qa_list


