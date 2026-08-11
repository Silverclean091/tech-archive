"""사용자의 입력값을 기반으로 RAG 검색을 수행합니다."""

import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "report_agent.settings")
django.setup()

from pgvector.django import CosineDistance
from reports.models import DocumentChunk
from agent.embedding import embed_text

def search_chunks(query: str, top_k: int = 5, max_distance: float = 0.5):
    """사용자가 입력한 쿼리와 유사한 DocumentChunk를 N개(5개) 검색합니다."""
    query_vector = embed_text(query).tolist()
    chunks = (
        DocumentChunk.objects
        .annotate(distance=CosineDistance("embedding", query_vector))
        .filter(distance__lte=max_distance)
        .order_by("distance")[:top_k]
    )
    return chunks

# 테스트용 main 코드 (실제 실행 시 주석 처리)
# if __name__ == "__main__":
#     results = search_chunks("AX 전환")
#     for chunk in results:
#         print(f"거리 = {chunk.distance:.4f}, 청크 내용 = {chunk.chunk_text[:100]}")