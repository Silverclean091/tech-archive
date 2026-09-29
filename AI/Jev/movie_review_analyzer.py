from dotenv import load_dotenv
from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

load_dotenv()

# 1. state: 이번에 분석할 실제 리뷰 내용
state = {
    "review": "스토리는 뻔했지만 배우들 연기가 정말 좋아서 시간 가는 줄 몰랐다. 다만 마지막 반전은 좀 억지스러웠다."
}

# 2. questions: 이 리뷰를 보고 물어볼 질문들
questions = {
    # Choice: 여러 후보 중 하나를 고름
    "main_topic": Choice(
        instructions="이 리뷰가 가장 많이 언급하는 요소는?",
        criteria={
            "story": "줄거리, 각본, 전개, 반전, 개연성 등 이야기 구조에 대한 언급. 예: '결말이 뻔했다', '전개가 지루했다'",
            "acting": "배우의 연기력, 표현력, 캐릭터 소화력에 대한 언급. 예: '연기가 자연스러웠다', '몰입감 있는 연기'",
            "visual": "촬영, 미술, 색감, CG, 편집 등 시각적 연출에 대한 언급. 예: '영상미가 뛰어났다', '연출이 세련됐다'",
            "sound": "배경음악, OST, 효과음, 음향에 대한 언급. 예: '음악이 감동적이었다', 'OST가 좋았다'",
        },
    ),
    # Noul: 예/아니오로 딱 떨어지는 질문
    "contains_spoiler": Noul(
        instructions="이 리뷰가 영화의 결말이나 주요 반전을 구체적으로 언급하는가? (스포일러가 포함되어 있는가?)"
    ),
    # Score: 등급/정도를 판단
    "sentiment": Score(
        instructions="이 리뷰의 전반적인 평가는?",
        criteria=["매우 부정적", "부정적", "중립/혼재", "긍정적", "매우 긍정적"],
    ),
}

# 3. 실제 API 호출
with TypeSafeClient() as client:  # TYPESAFE_API_KEY 환경변수를 자동으로 읽음
    response = client.system_one(state=state, questions=questions)

# 4. 결과 출력
main_topic = response.answers["main_topic"]
contains_spoiler = response.answers["contains_spoiler"]
sentiment = response.answers["sentiment"]

print("=== 영화 리뷰 분석 결과 ===")
print(f"입력 리뷰: {state['review']}")
print()

# 주요 논점 (Choice)
print("[주요 논점]")
print(f"  결과: {main_topic.choice}")
print(f"  확신도: {main_topic.confidence:.2f}")

# 스포일러 포함 여부 (Noul)
print()
print("[스포일러 포함 여부]")
print(f"  포함 확률: {contains_spoiler.noul:.2f}")

# 전반적 평가 (Score)
print()
print("[전반적 평가]")
print(f"  결과: {sentiment.legend[round(sentiment.score)]}")
print(f"  점수: {sentiment.score:.2f} / 4")
print(f"  확신도: {sentiment.confidence:.2f}")