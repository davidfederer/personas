# import os
# from openai import AzureOpenAI
# import dotenv
# dotenv.load_dotenv('.azure/personas-dev/.env')

# # Print all relevant environment variables
# print("AZURE_OPENAI_API_KEY:", os.getenv("AZURE_OPENAI_API_KEY"))
# print("AZURE_OPENAI_ENDPOINT:", os.getenv("AZURE_OPENAI_ENDPOINT"))
# print("AZURE_OPENAI_EMB_DEPLOYMENT:", os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT"))
# print("AZURE_OPENAI_API_VERSION:", os.getenv("AZURE_OPENAI_API_VERSION"))
# # Load environment variables
# api_key = os.getenv("AZURE_OPENAI_API_KEY")
# endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
# deployment = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")
# api_version = os.getenv("AZURE_OPENAI_API_VERSION")

# client = AzureOpenAI(
#     api_key=api_key,
#     api_version=api_version,
#     azure_endpoint=endpoint,
# )

# # Print the constructed embedding endpoint
# print("Embedding endpoint:", endpoint)
# embedding_url = f"{endpoint.rstrip('/')}/openai/deployments/{deployment}/embeddings?api-version={api_version}"
# print("Text embedding endpoint URL:", embedding_url)
# print("Client object:", client)
# # Test embedding call
# response = client.embeddings.create(
#     model=deployment,
#     input=["This is a test sentence for embedding."]
# )

# print(response)

import os
import dotenv
from openai import AzureOpenAI

# Load environment variables exactly as prepdocs.py does
dotenv.load_dotenv('.azure/personas-dev/.env')

# Use the same variable names as prepdocs.py
api_key = os.getenv("AZURE_OPENAI_API_KEY")
endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
deployment = os.getenv("AZURE_OPENAI_EMB_DEPLOYMENT")
api_version = os.getenv("AZURE_OPENAI_API_VERSION")
emb_model_name = os.getenv("AZURE_OPENAI_EMB_MODEL_NAME")
emb_dimensions = os.getenv("AZURE_OPENAI_EMB_DIMENSIONS")
azure_openai_service = os.getenv("AZURE_OPENAI_SERVICE")

# Print all relevant environment variables
print("AZURE_OPENAI_API_KEY:", api_key)
print("AZURE_OPENAI_ENDPOINT:", endpoint)
print("AZURE_OPENAI_EMB_DEPLOYMENT:", deployment)
print("AZURE_OPENAI_API_VERSION:", api_version)
print("AZURE_OPENAI_EMB_MODEL_NAME:", emb_model_name)
print("AZURE_OPENAI_EMB_DIMENSIONS:", emb_dimensions)
print("AZURE_OPENAI_SERVICE:", azure_openai_service)

# Construct the embedding endpoint URL as prepdocs would
embedding_url = f"{endpoint.rstrip('/')}/openai/deployments/{deployment}/embeddings?api-version={api_version}"
print("Text embedding endpoint URL:", embedding_url)

# Comment out the previous test code and use the same client construction as prepdocs
client = AzureOpenAI(
    api_key=api_key,
    api_version=api_version,
    azure_endpoint=endpoint,
)

# Test embedding call using the deployment name (as model)
try:
    response = client.embeddings.create(
        model=deployment,
        input=["This is a test sentence for embedding."]
    )
    print("Embedding response:", response)
except Exception as e:
      print("Error calling embedding endpoint:", e)