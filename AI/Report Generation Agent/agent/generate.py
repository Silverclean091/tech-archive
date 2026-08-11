"""LangGraph 라이브러리를 활용하여 보고서 생성을 위한 State와 Node, Edge를 정의합니다.

ReportState: 보고서 생성 과정에 필요한 상태를 TypedDict 자료형으로 정의합니다.

search_node: 사용자가 입력한 키워드를 기반으로 RAG 검색을 수행하여 참고 청크를 가져옵니다.
outline_node: 보고서 생성 시 참고할 개요를 생성합니다. (OpenAI API 호출)
draft_node: 키워드와 개요를 기반으로 보고서 초안을 작성합니다. (OpenAI API 호출)
collect_node: 사용자가 입력한 키워드로 네이버 뉴스와 Tavily에서 자료를 수집하고, DB에 저장합니다.

should_collect: 참고 청크가 부족할 경우, collect_node를 실행하도록 조건을 설정합니다.
human_review_node: 사용자가 보고서 초안을 검토하고, 필요 시 수정을 요청할 수 있는 노드입니다.
route_after_review: 사용자의 보고서 확인 후 응답값을 기반으로 다음 노드를 결정합니다.
"""

import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "report_agent.settings")
django.setup()

from typing import TypedDict
from reports.models import Report
from agent.search import search_chunks
from agent.collect import collect_documents
from agent.embed_documents import embed_documents

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt

from openai import OpenAI

client = OpenAI()
checkpointer = MemorySaver()



class ReportState(TypedDict):
    """보고서 생성 과정에 필요한 상태를 TypedDict 자료형으로 정의합니다."""
    keyword: str    # 사용자가 입력한 키워드
    report_id: int  # 보고서 식별을 위한 report_id
    chunks: list    # search_chunks()로 가져온 참고 청크 목록
    outline: str    # 생성된 개요
    draft: str      # 생성된 보고서 초안
    retry_count: int  # 재검색 횟수 기록을 위한 상태 변수 (무한 루프 방지용)
    human_response: dict  # 사람이 응답한 내용 



def search_node(state: ReportState) -> dict:
    """사용자가 입력한 키워드를 기반으로 RAG 검색을 수행하여 참고 청크를 가져옵니다."""
    keyword = state["keyword"]
    results = search_chunks(keyword, top_k=5)
    chunks = [c.chunk_text for c in results]
    return {"chunks": chunks}

def outline_node(state: ReportState) -> dict:
    """보고서 생성 시 참고할 개요를 생성합니다. (OpenAI API 호출)"""
    keyword = state["keyword"]
    chunks = state["chunks"]

    # 각 청크의 텍스트를 줄바꿈으로 이어붙여서 참고 자료 전체를 하나의 문자열로 만들기
    reference_text = "\n".join(chunks)

    response = client.chat.completions.create(
        model = "gpt-4o-mini",
        messages = [
            {"role": "system", 
             "content": """
                당신은 전문적인 보고서를 작성하는 AI입니다.
                사용자가 입력한 키워드와 참고 자료를 기반으로, 체계적이고 논리적인 보고서 개요를 작성합니다.
                개요는 서론, 본론, 결론의 구조를 갖추고, 본론은 2~3개의 소주제로 나누어 작성합니다.
                해당 작업에서는 본문은 작성하지 않으며, 개요만 한 줄로 작성합니다."""
            },
            {"role": "user", 
             "content": f"""
                보고서 주제: {keyword}\n\n
                참고 자료:\n{reference_text}\n\n
                위의 참고 자료를 기반으로, 체계적이고 논리적인 보고서 개요를 작성합니다."""
            }
        ]
    )
    outline = response.choices[0].message.content
    return {"outline": outline}

def draft_node(state: ReportState) -> dict:
    """키워드와 개요를 기반으로 보고서 초안을 작성합니다. (OpenAI API 호출)"""
    keyword = state["keyword"]
    chunks = state["chunks"]
    outline = state["outline"]

    reference_text = "\n".join(f"[{i+1}] {chunk}" for i, chunk in enumerate(chunks))

    response = client.chat.completions.create(
        model = "gpt-4o-mini",
        messages = [
            {"role": "system", 
             "content": """당신은 전문적인 보고서를 작성하는 AI입니다.
             반드시 주어진 참고 자료의 내용만을 바탕으로 작성하고, 참고 자료로 답변하기 부족하면 그 사실을 명시합니다.
             보고서의 구조는 서론, 본론, 결론으로 구성하며, 각 부분은 개요를 참고하여 작성합니다.
             각 문장마다 어떤 자료를 참고했는지 [1], [2]와 같이 청크 번호를 표시합니다."""
             },
            {"role": "user",
             "content": f"""
             보고서 주제: {keyword}\n\n
             보고서 개요: {outline}\n\n
             참고 자료:\n{reference_text}\n\n
             위의 개요와 참고 자료를 기반으로, 체계적이고 논리적인 보고서 초안을 작성합니다."""
            }
        ]
    )
    draft = response.choices[0].message.content
    return {"draft": draft}

def collect_node(state: ReportState) -> dict:
    """사용자가 입력한 키워드로 네이버 뉴스와 Tavily에서 자료를 수집하고, DB에 저장합니다."""
    keyword = state["keyword"]
    search_query = collect_documents(keyword)
    for document in search_query.documents.all():
        embed_documents(document)
    return {"retry_count": state["retry_count"] + 1}



def should_collect(state: ReportState) -> str:
    """참고 청크가 부족할 경우, collect_node를 실행하도록 조건을 설정합니다."""
    if len(state["chunks"]) < 3 and state["retry_count"] < 2:
        return "collect"
    return "outline"

def human_review_node(state: ReportState) -> dict:
    """사용자가 보고서 초안을 검토하고, 필요 시 수정을 요청할 수 있는 노드입니다."""
    response = interrupt({"draft": state["draft"]})
    return {"human_response": response}

def route_after_review(state: ReportState) -> str:
    """사용자의 보고서 확인 후 응답값을 기반으로 다음 노드를 결정합니다."""
    action = state["human_response"]["action"]
    if action == "approve":
        return "save"
    elif action == "edit":
        return "edit"
    else:
        return "revise"



def revise_node(state: ReportState) -> dict:
    """사용자의 수정 지시를 받아 초안(draft)를 LLM이 자동으로 수정하는 노드입니다."""
    draft = state["draft"]
    instruction = state["human_response"]["instruction"]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """
                당신은 보고서 수정을 도와주는 전문 Agent입니다.
                기존의 보고서 본문을 사용자의 요청에 맞게 수정합니다.
                요청과 관련이 없는 부분은 수정하지 않고 원본을 그대로 유지합니다. 
            """},
            {"role": "user", "content": f"""
                기존 본문:\n{draft}\n\n
                수정 요청:\n{instruction}\n\n
                위 요청을 반영해서 본문 전체를 다시 작성합니다.
            """},
        ],
    )
    revised_draft = response.choices[0].message.content
    return {"draft": revised_draft}

def edit_node(state: ReportState) -> dict:
    """사용자가 직접 수정한 본문을 다시 state에 반영하는 노드입니다."""
    new_text = state["human_response"]["text"]
    return {"draft": new_text}

def save_node(state: ReportState) -> dict:
    """작성한 보고서 초안(draft)을 최종안으로 승인하고 DB에 저장하는 노드입니다."""
    report = Report.objects.get(id=state["report_id"])
    report.content = state["draft"]
    report.status = "completed"
    report.save()
    return {}


keyword = "AX전환"
report = Report.objects.create(keyword=keyword)
initial_state = {
    "keyword": keyword,
    "report_id": report.id,
    "chunks": [], "outline": "", "draft": "", 
    "retry_count": 0, "human_response": {}
}


graph = StateGraph(ReportState)

graph.add_node("search", search_node)
graph.add_node("collect", collect_node)
graph.add_node("outline", outline_node)
graph.add_node("draft", draft_node)
graph.add_node("review", human_review_node)
graph.add_node("revise", revise_node)
graph.add_node("edit", edit_node)
graph.add_node("save", save_node)

graph.add_edge(START, "search")
graph.add_conditional_edges(
    "search",
    should_collect,
    {
        "collect": "collect",
        "outline": "outline"
    },
)
graph.add_edge("collect", "search")  # 자료를 추가했으니, 해당 자료를 기반으로 재검색
graph.add_edge("outline", "draft")

graph.add_edge("draft", "review")
graph.add_conditional_edges(
    "review",
    route_after_review,
    {"save": "save", "edit": "edit", "revise": "revise"}
)
graph.add_edge("revise", "review")  # 수정 반영 후, 다시 검토를 위한 수정 단계 진입
graph.add_edge("edit", "review")    # 수정 반영 후, 다시 검토를 위한 수정 단계 진입

graph.add_edge("save", END)

app = graph.compile(checkpointer=checkpointer)






if __name__ == "__main__":
    from langgraph.types import Command
    from reports.models import Report
    from agent.export import export_to_docx

    keyword = "AX전환"
    report = Report.objects.create(keyword=keyword)
    # 이번 테스트를 위한 Report 행을 미리 만들어둠

    config = {"configurable": {"thread_id": str(report.id)}}
    # report.id를 thread_id로 사용 (나중에 API에서도 이 방식 그대로 씀)

    initial_state = {
        "keyword": keyword,
        "report_id": report.id,
        "chunks": [], "outline": "", "draft": "", "retry_count": 0, "human_response": {},
    }

    result = app.invoke(initial_state, config=config)
    # 1차 실행: search → outline → draft → review에서 멈춤
    print("=== 초안 (검토 대기) ===")
    print(result)

    result = app.invoke(Command(resume={"action": "revise", "instruction": "서론을 더 짧게 줄여줘"}), config=config)
    # 2차 실행: 수정 지시 → revise → 다시 review에서 멈춤
    print("=== 수정된 초안 (검토 대기) ===")
    print(result)

    result = app.invoke(Command(resume={"action": "approve"}), config=config)
    # 3차 실행: 승인 → save → END
    print("=== 최종 완료 ===")
    print(result)

    report.refresh_from_db()
    # save_node가 DB에 저장한 최신 내용을 다시 불러옴
    file_path = export_to_docx(report)
    print(f"파일 저장됨: {file_path}")