from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import weaviate
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Portfolio RAG Service")

# Initialize clients
openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Connect to Weaviate
weaviate_client = weaviate.Client(
    url=os.getenv('WEAVIATE_URL', 'http://localhost:8080'),
    additional_headers={
        'X-OpenAI-Api-Key': os.getenv('OPENAI_API_KEY', '')
    }
)

class QueryRequest(BaseModel):
    question: str
    symbols: List[str]
    max_results: int = 5

class Citation(BaseModel):
    document: str
    section: str
    pageNumber: int | None = None
    relevanceScore: float

class QueryResponse(BaseModel):
    question: str
    answer: str
    citations: List[Citation]
    confidence: float
    llmTokensUsed: int

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/query", response_model=QueryResponse)
async def query_earnings(request: QueryRequest):
    """
    Query SEC filings for earnings impact analysis
    """
    try:
        # Search Weaviate for relevant SEC filing sections
        results = search_filings(request.question, request.symbols, request.max_results)

        if not results:
            raise HTTPException(status_code=404, detail="No relevant filings found")

        # Generate answer using GPT-4
        answer, tokens_used = generate_answer(request.question, results, request.symbols)

        # Build citations
        citations = [
            Citation(
                document=f"{r['symbol']} 10-K",
                section=r['section'],
                pageNumber=r.get('page'),
                relevanceScore=r['score']
            )
            for r in results
        ]

        # Calculate confidence based on relevance scores
        avg_score = sum(r['score'] for r in results) / len(results)
        confidence = min(avg_score, 1.0)

        return QueryResponse(
            question=request.question,
            answer=answer,
            citations=citations,
            confidence=confidence,
            llmTokensUsed=tokens_used
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def search_filings(question: str, symbols: List[str], limit: int = 5) -> List[Dict]:
    """
    Search SEC filings in Weaviate using hybrid search
    """
    try:
        # For MVP, return mock data (in production, query Weaviate)
        # This would use hybrid search: vector similarity + BM25

        mock_results = [
            {
                'symbol': symbols[0] if symbols else 'AAPL',
                'section': 'Risk Factors',
                'content': 'The Company faces risks related to product demand, supply chain disruptions, and competitive pressures in the technology sector.',
                'page': 12,
                'score': 0.92
            },
            {
                'symbol': symbols[0] if symbols else 'AAPL',
                'section': "Management's Discussion and Analysis",
                'content': 'Revenue growth was driven by strong iPhone sales and expanding Services segment, offset by challenges in wearables.',
                'page': 25,
                'score': 0.88
            },
            {
                'symbol': symbols[0] if symbols else 'AAPL',
                'section': 'Financial Performance',
                'content': 'Operating margins improved to 30.1% due to favorable product mix and cost optimization initiatives.',
                'page': 32,
                'score': 0.85
            }
        ]

        # In production, query Weaviate:
        # response = weaviate_client.query.get(
        #     'SECFiling',
        #     ['symbol', 'section', 'content', 'page']
        # ).with_hybrid(
        #     query=question,
        #     alpha=0.5  # Balance between vector and keyword search
        # ).with_where({
        #     'path': ['symbol'],
        #     'operator': 'ContainsAny',
        #     'valueTextArray': symbols
        # }).with_limit(limit).do()

        return mock_results

    except Exception as e:
        print(f"Error searching filings: {e}")
        return []

def generate_answer(question: str, context: List[Dict], symbols: List[str]) -> tuple[str, int]:
    """
    Generate answer using GPT-4 with retrieved context
    """
    # Build context from retrieved documents
    context_text = "\n\n".join([
        f"From {r['symbol']} {r['section']} (Page {r.get('page', 'N/A')}):\n{r['content']}"
        for r in context
    ])

    prompt = f"""You are a financial analyst. Answer the following question about the portfolio holdings using ONLY the provided SEC filing excerpts.

Portfolio Holdings: {', '.join(symbols)}

Question: {question}

SEC Filing Context:
{context_text}

Instructions:
- Provide a clear, concise answer (2-3 paragraphs)
- Reference specific sections when making claims
- If the context doesn't contain relevant information, acknowledge the limitation
- Focus on actionable insights for portfolio risk assessment

Answer:"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a financial analyst specializing in SEC filing analysis."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=400
        )

        answer = response.choices[0].message.content
        tokens_used = response.usage.total_tokens

        return answer, tokens_used

    except Exception as e:
        print(f"Error generating answer: {e}")
        return "Unable to generate analysis at this time.", 0

@app.get("/collections")
async def list_collections():
    """List available Weaviate collections"""
    try:
        schema = weaviate_client.schema.get()
        return {"collections": [c['class'] for c in schema.get('classes', [])]}
    except Exception as e:
        return {"collections": [], "error": str(e)}
