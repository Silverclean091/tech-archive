"""
reports 앱의 데이터 모델.

- Report: 보고서 1건. 검색부터 생성까지 전체 파이프라인을 묶는 중심 테이블.
- SearchQuery: 특정 Report를 위해 실행한 검색 시도 1건.
- Document: 검색으로 수집된 원본 자료 1건 (네이버/Tavily).
- DocumentChunk: Document를 잘게 나눠 임베딩한 조각 1건. RAG 검색 대상.
- ReportChunkUsage: 어떤 Report가 어떤 DocumentChunk를 인용했는지 연결하는 테이블.
"""

from django.db import models
from pgvector.django import VectorField


class Report(models.Model):
    title = models.CharField(max_length=255, blank=True)
    keyword = models.CharField(max_length=255)
    length_option = models.CharField(max_length=50, blank=True)
    tone_option = models.CharField(max_length=50, blank=True)
    purpose_text = models.TextField(blank=True)
    content = models.TextField(blank=True)
    file_path = models.CharField(max_length=500, blank=True)
    file_format = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title or self.keyword


class SearchQuery(models.Model):
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="search_queries")
    keyword = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.keyword


class Document(models.Model):
    SOURCE_CHOICES = [
        ("naver", "Naver"),
        ("tavily", "Tavily"),
    ]

    search_query = models.ForeignKey(SearchQuery, on_delete=models.CASCADE, related_name="documents")
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    title = models.CharField(max_length=500)
    url = models.URLField(max_length=1000)
    content = models.TextField()
    collected_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class DocumentChunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    chunk_text = models.TextField()
    embedding = VectorField(dimensions=1024)  # BGE-M3 임베딩 차원
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.chunk_text[:50]


class ReportChunkUsage(models.Model):
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="chunk_usages")
    document_chunk = models.ForeignKey(DocumentChunk, on_delete=models.CASCADE, related_name="report_usages")

    class Meta:
        unique_together = ("report", "document_chunk")