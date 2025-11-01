# Read Excel file from Azure Blob Storage into a pandas DataFrame
import os
from azure.identity import DefaultAzureCredential
import pandas as pd
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
import json

# Load environment variables from .env file
load_dotenv(".azure/personas-dev/.env")

# Get storage account name from environment variable
account_name = os.getenv("AZURE_STORAGE_ACCOUNT")
container_name = os.getenv("AZURE_STORAGE_CONTAINER")
blob_name = "dataset_cleaned.xlsx"
print(container_name, blob_name)

# Create a credential using your azd/az login session
credential = DefaultAzureCredential()

# Build the blob service client using the account URL and credential
account_url = f"https://{account_name}.blob.core.windows.net"
blob_service = BlobServiceClient(account_url=account_url, credential=credential)
container_client = blob_service.get_container_client(container_name)
blob_client = container_client.get_blob_client(blob_name)

import openpyxl
from io import BytesIO

# # Download the Excel file as bytes
excel_bytes = blob_client.download_blob().readall()
df = pd.read_excel(BytesIO(excel_bytes))

# df.set_index("Come-back-Later Code?", inplace=True)
df = df.dropna(axis=1, how='all')
df = df.loc[:, ~(df == "").all()]

df["Submitted Date?"] = pd.to_datetime(df["Submitted Date?"], errors="coerce").dt.strftime("%Y-%m-%d")

df_processed = df.apply(lambda col: col.where(col.isna() | (col == ""), f"{col.name}: " + col.astype(str)))
df_final = pd.DataFrame({"input_text": df_processed.astype(str).agg(" ".join, axis=1)})


# Save processed file locally
local_processed_path = "data_prep/processed_input_text.csv"
df_final.to_csv(local_processed_path, index=True)

# Upload processed file to the same Azure Blob Storage container
processed_blob_name = "processed_input_text.csv"
processed_blob_client = container_client.get_blob_client(processed_blob_name)
with open(local_processed_path, "rb") as data:
	processed_blob_client.upload_blob(data, overwrite=True)
print(f"[ok] Uploaded processed file to container '{container_name}' as blob '{processed_blob_name}'", flush=True)

# --- Structured JSON output logic ---
output_json_path = "data_prep/structured_output.json"

# If index is not set, set it to Come-back-Later Code?
if "Come-back-Later Code?" in df.columns:
	df.set_index("Come-back-Later Code?", inplace=True)

output = []
for idx, row in df.iterrows():
	obj = {
		"AreaPath": "B&LPersonas",
		"AssignedTo": None,
		"Categories": "B&LSurvey",
		"ChangedDate": None,
		"ClosedDate": None,
		"CreatedDate": row.get("Submitted Date?", None),
		"Description": "\n".join([
			f"{col}: {row[col]}"
			for col in df.columns
			if col not in ["Complete Type?"] and pd.notna(row[col]) and row[col] != ""
		]),
		"Id": idx,
		"State": row.get("Complete Type?", None),
		"StateChangeDate": None,
		"Tags": "Survey2024",
		"Title": str(idx)
	}
	output.append(obj)

# Save output JSONs as a list
with open(output_json_path, "w", encoding="utf-8") as f:
	json.dump(output, f, ensure_ascii=False, indent=2)

print(f"[ok] Structured output JSON written to {output_json_path}")