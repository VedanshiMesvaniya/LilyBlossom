from crawler.change_detector import detect_changes


def test_detects_release_status_change():
    existing = {"canonical_title": "The Loyal Pin", "release_status": "Upcoming"}
    new_values = {"release_status": "Airing"}

    changes = detect_changes(existing, new_values)

    assert len(changes) == 1
    assert changes[0].field == "release_status"
    assert changes[0].old_value == "Upcoming"
    assert changes[0].new_value == "Airing"


def test_unknown_new_value_never_overwrites_known_value():
    existing = {"episode_count": 12}
    new_values = {"episode_count": None}

    changes = detect_changes(existing, new_values)

    assert changes == []


def test_no_change_when_values_match():
    existing = {"description": "Same text"}
    new_values = {"description": "Same text"}

    assert detect_changes(existing, new_values) == []
