"""LangGraph 라이브러리를 활용하여 보고서 생성을 위한 State와 Node, Edge를 정의합니다.

ReportState: 보고서 생성 과정에 필요한 상태를 TypedDict 자료형으로 정의합니다.
search_node: 사용자가 입력한 키워드를 기반으로 RAG 검색을 수행하여 참고 청크를 가져옵니다.
outline_node: 보고서 생성 시 참고할 개요를 생성합니다. (OpenAI API 호출)
draft_node: 키워드와 개요를 기반으로 보고서 초안을 작성합니다. (OpenAI API 호출)
"""

from typing import TypedDict
from agent.search import search_chunks
from langgraph.graph import StateGraph, START, END
from openai import OpenAI

client = OpenAI()


class ReportState(TypedDict):
    """보고서 생성 과정에 필요한 상태를 TypedDict 자료형으로 정의합니다."""
    keyword: str  # 사용자가 입력한 키워드
    chunks: list  # search_chunks()로 가져온 참고 청크 목록
    outline: str  # 생성된 개요
    draft: str    # 생성된 보고서 초안


def search_node(state: ReportState) -> dict:
    """사용자가 입력한 키워드를 기반으로 RAG 검색을 수행하여 참고 청크를 가져옵니다."""
    keyword = state["keyword"]
    chunks = search_chunks(keyword, top_k=5)
    return {"chunks": chunks}

def outline_node(state: ReportState) -> dict:
    """보고서 생성 시 참고할 개요를 생성합니다. (OpenAI API 호출)"""
    keyword = state["keyword"]
    chunks = state["chunks"]

    # 각 청크의 텍스트를 줄바꿈으로 이어붙여서 참고 자료 전체를 하나의 문자열로 만들기
    reference_text = "\n".join([chunk.chunk_text for chunk in chunks])

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

    # 각 청크 앞에 순번([1], [2]...)을 붙여서 한 줄씩 만든 뒤, 줄바꿈으로 이어붙여 하나의 문자열로 합침
    # enumerate(chunks)는 리스트를 순회하며 인덱스(i)와 값(chunk)을 동시에 꺼내줌
    # i+1을 쓰는 이유는 인덱스가 0부터 시작하므로 사람이 보기 편하게 1부터 번호를 매기기 위함
    reference_text = "\n".join(f"[{i+1}] {chunk.chunk_text}" for i, chunk in enumerate(chunks))

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


graph = StateGraph(ReportState)

graph.add_node("search", search_node)
graph.add_node("outline", outline_node)
graph.add_node("draft", draft_node)

graph.add_edge(START, "search")
graph.add_edge("search", "outline")
graph.add_edge("outline", "draft")
graph.add_edge("draft", END)

app = graph.compile()




if __name__ == "__main__":
    # 이 파일을 직접 실행했을 때만 아래 코드가 동작
    import os
    import django

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "report_agent.settings")
    django.setup()
    # search_chunks가 DB에 접근하므로 장고 초기화 필요

    initial_state = {"keyword": "AX전환", "chunks": [], "outline": "", "draft": ""}
    # 그래프에 넣어줄 초기 State. keyword만 채우고 나머지는 빈 값으로 시작

    final_state = app.invoke(initial_state)
    # 컴파일된 그래프를 실행. START부터 END까지 search → outline → draft 순서로 자동 실행됨
    # 각 노드가 반환한 값들이 순서대로 State에 계속 합쳐지고, 최종 결과가 final_state로 반환됨

    print("=== 개요 ===")
    print(final_state["outline"])
    # 최종 State에서 개요 확인

    print("\n=== 초안 ===")
    print(final_state["draft"])
    # 최종 State에서 초안 확인