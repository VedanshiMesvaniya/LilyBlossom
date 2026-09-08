from crawler.normalizer import normalize_title, slugify


def test_case_and_whitespace_are_ignored():
    assert normalize_title("The Loyal Pin") == normalize_title("THE LOYAL PIN")


def test_hyphens_and_colons_are_treated_as_spaces():
    assert normalize_title("The-Loyal-Pin") == normalize_title("The Loyal Pin")
    assert normalize_title("The Loyal Pin: Series") == normalize_title("The Loyal Pin Series")


def test_ampersand_is_expanded():
    assert normalize_title("Gap & Gab") == normalize_title("Gap and Gab")


def test_season_marker_is_preserved_not_stripped():
    # Different seasons must stay distinguishable after normalization.
    assert normalize_title("Bad Buddy Season 2") != normalize_title("Bad Buddy")


def test_slugify_appends_year():
    assert slugify("The Loyal Pin", 2024) == "the-loyal-pin-2024"
