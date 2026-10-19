"""외부 메타데이터 소스. 각 함수는 httpx.Client 를 받아 테스트에서 가짜 전송으로 바꿀 수 있다."""


class UpstreamError(Exception):
    """외부 API 실패 (429·5xx·네트워크). 조회는 다음 소스로 넘어간다."""

    def __init__(self, source: str, message: str) -> None:
        super().__init__(f"{source}: {message}")
        self.source = source
