"""BGE-M3 임베딩 모델을 불러오고, 이를 청킹한 뒤 임베딩 벡터로 변환하는 기능을 제공합니다.

get_model: BGE-M3 임베딩 모델을 가져옵니다. 이미 로드된 모델이 있으면 재사용합니다.
chunk_text: 주어진 텍스트를 일정한 크기로 청킹합니다. (현재 기본값: 500자)
embed_text: 주어진 텍스트를 임베딩 벡터로 변환합니다.
"""

from sentence_transformers import SentenceTransformer

_model = None


def get_model():
    """임베딩 모델을 가져옵니다. 이미 로드된 모델이 있으면 재사용합니다."""
    global _model
    if _model is None:
        _model = SentenceTransformer("BAAI/bge-m3")
    return _model

def chunk_text(text: str, chunk_size: int = 500):
    """주어진 텍스트를 일정한 크기로 청킹합니다."""
    text = text.strip()
    if not text:
        return []
    # 0부터 len(text)까지 chunk_size 간격으로 슬라이싱하여 청크 리스트를 생성
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

def embed_text(text: str):
    """주어진 텍스트를 임베딩 벡터로 변환합니다."""
    model = get_model()
    return model.encode(text)


# 함수 테스트용 코드 (실제 실행 시 주석 처리)
# if __name__ == "__main__":
#     sample_text = "모든 기업이 AX 전환을 고민하고 있습니다. " * 30

#     chunks = chunk_text(sample_text)
#     print(f"청크 개수: {len(chunks)}")

#     for i, chunk in enumerate(chunks):
#         vector = embed_text(chunk)
#         print(f"청크 {i}: 길이={len(chunk)}자, 벡터 차원={len(vector)}")