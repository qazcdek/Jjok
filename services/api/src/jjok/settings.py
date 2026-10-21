"""환경 설정. DevDocs/07-dev-environment.md §4"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

AppEnv = Literal["dev", "prod"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: AppEnv = "dev"
    firebase_project_id: str = "demo-jjok"
    # 에뮬레이터 모드는 127.0.0.1 로 접속한다 (DevDocs/07-dev-environment.md §3)
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]
    llama_base_url: str | None = None
    # 외부 메타데이터 API 키 (서버 전용). 없으면 키 없이 호출한다 (한도가 낮음)
    openalex_api_key: SecretStr | None = None
    s2_api_key: SecretStr | None = None
    # Crossref polite pool 연락처 (선택). 운영자 주소를 쓴다. 사용자 이메일을 넣지 않는다
    crossref_mailto: str | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        # 환경 변수는 쉼표 구분: CORS_ORIGINS=http://a,http://b
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def llama_allowed(self) -> bool:
        """llama server 는 dev 에서만 허용한다 (N-06).

        클라이언트에서 숨기는 것만으로는 부족하므로 서버가 판단한다.
        """
        return self.app_env == "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()
