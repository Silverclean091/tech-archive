import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "report_agent.settings")
django.setup()

import re
import requests
from dotenv import load_dotenv
from tavily import TavilyClient
from reports.models import Report, SearchQuery, Document, DocumentChunk

load_dotenv()


def search_naver_news(query: str):
    """네이버 뉴스 검색 API를 사용하여 뉴스 기사를 검색합니다."""
    url = "https://naverapihub.apigw.ntruss.com/search/v1/news"
    headers = {
        "X-NCP-APIGW-API-KEY-ID": os.getenv("NAVER_CLIENT_ID"),
        "X-NCP-APIGW-API-KEY": os.getenv("NAVER_CLIENT_SECRET"),
    }
    params = {"query": query, "display": 5, "sort": "date"}
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()["items"]

def search_tavily(query: str):
    """Tavily 검색 API를 사용하여 자료를 검색합니다."""
    client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
    result = client.search(query=query, max_results=5)
    return result["results"]

def clean_html(text: str):
    """HTML의 태그 문법을 제거하고 텍스트값만 남깁니다."""
    return re.sub(r"<.*?>", "", text or "")


if __name__ == "__main__":
    # naver_results = search_naver_news("AX전환")
    # for item in naver_results:
    #     print("[네이버]", item["title"])

    # tavily_results = search_tavily("AX전환")
    # for item in tavily_results:
    #     print("[Tavily]", item["title"])

    keyword = "AX전환"

    report = Report.objects.create(keyword=keyword)
    search_query = SearchQuery.objects.create(report=report, keyword=keyword)

    naver_results = search_naver_news(keyword)
    for item in naver_results:
        Document.objects.create(
            search_query=search_query,
            source="naver",
            title=clean_html(item["title"]),
            url=item["link"],
            content=clean_html(item.get("description", "")),
        )

    tavily_results = search_tavily(keyword)
    for item in tavily_results:
        Document.objects.create(
            search_query=search_query,
            source="tavily",
            title=item.get("title", ""),
            url=item["url"],
            content=item.get("content", ""),
        )

    print(f"Report id: {report.id}, 저장된 Document 수: {search_query.documents.count()}")