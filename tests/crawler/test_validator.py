import pytest

from crawler.models import RawCrawlItem
from crawler.validator import validate_item, ValidationError


def base_item(**overrides):
    defaults = dict(
        title="The Loyal Pin",
        type="Series",
        year=2024,
        source_url="https://example.invalid/x",
        source_name="Test",
    )
    defaults.update(overrides)
    return RawCrawlItem(**defaults)


def test_valid_item_passes():
    validate_item(base_item())


def test_movie_with_episode_count_is_rejected():
    item = base_item(type="Movie", episode_count=12)
    with pytest.raises(ValidationError):
        validate_item(item)


def test_implausible_year_is_rejected():
    item = base_item(year=1800)
    with pytest.raises(ValidationError):
        validate_item(item)
