import httpx

from . import UpstreamError

USER_AGENT = "Jjok/0.1 (https://github.com/qazcdek/Jjok; mailto:qazcde.k@gmail.com)"


def get(client: httpx.Client, source: str, url: str, **kwargs) -> httpx.Response | None:
    """GET. 404 는 None, 429·5xx·네트워크 오류는 UpstreamError."""
    try:
        res = client.get(url, **kwargs)
    except httpx.HTTPError as e:
        raise UpstreamError(source, f"요청 실패: {e}") from e
    if res.status_code == 404:
        return None
    if res.status_code == 429 or res.status_code >= 500:
        raise UpstreamError(source, f"HTTP {res.status_code}")
    if res.status_code >= 400:
        raise UpstreamError(source, f"HTTP {res.status_code}: {res.text[:200]}")
    return res
