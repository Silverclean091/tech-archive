"""원본 Document를 청킹하고 벡터 임베딩을 수행합니다.

embed_documents: 주어진 Document 객체를 청킹하고, 각 청크를 임베딩하여 DocumentChunk로 저장합니다."""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "report_agent.settings")
django.setup()

from reports.models import Document, DocumentChunk
from agent.embedding import chunk_text, embed_text


def embed_documents(document):
    """주어진 Document 객체를 청킹하고, 각 청크를 임베딩하여 DocumentChunk로 저장합니다."""
    chunks = chunk_text(document.content)
    for chunk in chunks:
        vector = embed_text(chunk).tolist()
        DocumentChunk.objects.create(
            document=document,
            chunk_text=chunk,
            embedding=vector
        )
    return len(chunks)

if __name__ == "__main__":
    documents = Document.objects.filter(chunks__isnull=True).distinct()
    total = 0

    for document in documents:
        count = embed_documents(document)
        total += count
        print(f"Document ID {document.id}에 대해 {count}개의 청크를 임베딩했습니다.")
    print(f"총 {total}개의 청크를 임베딩했습니다.")