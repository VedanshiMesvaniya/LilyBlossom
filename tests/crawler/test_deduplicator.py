from crawler.deduplicator import CandidateTitle, classify_match, find_best_match


def make_candidate(title, year=None, id_="1", tmdb_id=None, anilist_id=None, imdb_id=None):
    from crawler.normalizer import normalize_title

    return CandidateTitle(
        id=id_,
        normalized_title=normalize_title(title),
        year=year,
        country=None,
        tmdb_id=tmdb_id,
        anilist_id=anilist_id,
        imdb_id=imdb_id,
    )


def test_identical_title_and_year_is_a_duplicate():
    candidates = [make_candidate("The Loyal Pin", 2024)]
    match, score = find_best_match("The Loyal Pin", 2024, candidates)
    assert match is not None
    assert classify_match(score) == "duplicate"


def test_similar_title_different_year_is_uncertain_or_new():
    candidates = [make_candidate("The Loyal Pin", 2024)]
    match, score = find_best_match("The Loyal Pin", 2019, candidates)
    assert classify_match(score) in {"uncertain", "new"}


def test_unrelated_title_is_new():
    candidates = [make_candidate("The Loyal Pin", 2024)]
    match, score = find_best_match("My Ride, Our Romance", 2024, candidates)
    assert classify_match(score) == "new"


def test_shared_tmdb_id_is_a_duplicate_even_with_a_different_title():
    # A retitled re-release with a completely different title string
    # should still be caught as the same title when TMDB agrees.
    candidates = [make_candidate("The Loyal Pin", 2024, tmdb_id="12345")]
    match, score = find_best_match(
        "A Totally Different Title",
        2019,
        candidates,
        external_ids={"tmdb_id": "12345", "anilist_id": None, "imdb_id": None},
    )
    assert match is not None
    assert classify_match(score) == "duplicate"


def test_no_external_id_falls_back_to_fuzzy_matching():
    candidates = [make_candidate("The Loyal Pin", 2024, tmdb_id="12345")]
    match, score = find_best_match(
        "The Loyal Pin",
        2024,
        candidates,
        external_ids={"tmdb_id": None, "anilist_id": None, "imdb_id": None},
    )
    assert match is not None
    assert classify_match(score) == "duplicate"
