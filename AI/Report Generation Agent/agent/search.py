"""사용자의 입력값을 기반으로 RAG 검색을 수행합니다."""

from pgvector.django import CosineDistance
from reports.models import DocumentChunk
from agent.embedding import embed_text

def search_chunks(query: str, top_k: int = 5):
    """사용자가 입력한 쿼리와 유사한 DocumentChunk를 N개(5개) 검색합니다."""
    query_vector = embed_text(query).tolist()
    chunks = (
        DocumentChunk.objects
        .annotate(distance=CosineDistance("embedding", query_vector))
        .order_by("distance")[:top_k]
    )
    return chunks