"""Unit tests for environment-driven settings."""

from app.config import DEFAULT_CORS_ORIGINS, cors_origins


def test_cors_origins_default_to_dev_server() -> None:
    assert cors_origins({}) == list(DEFAULT_CORS_ORIGINS)
    assert cors_origins({"CORS_ORIGINS": ""}) == list(DEFAULT_CORS_ORIGINS)


def test_cors_origins_parse_trim_and_skip_empties() -> None:
    env = {"CORS_ORIGINS": " https://a.example , https://b.example ,,"}
    assert cors_origins(env) == ["https://a.example", "https://b.example"]
