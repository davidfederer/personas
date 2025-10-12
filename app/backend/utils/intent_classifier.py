from openai import AsyncOpenAI
import os

async def classify_intent(question: str, openai_client: AsyncOpenAI) -> str:
    prompt = (
        "Classify the following user question into one of these categories: "
        "qualitative and insights, quantitative and analytics, or creative.\n"
        f"Question: {question}\n"
        "Category:"
    )
    response = await openai_client.completions.create(
        model=os.getenv("AZURE_OPENAI_CHATGPT_DEPLOYMENT"),
        prompt=prompt,
        max_tokens=5,
        temperature=0
    )
    return response.choices[0].text.strip().lower()