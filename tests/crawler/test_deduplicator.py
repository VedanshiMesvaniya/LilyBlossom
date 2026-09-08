from crawler.deduplicator import CandidateTitle, classify_match, find_best_match


def make_candidate(title, year=None, id_="1"):
    from crawler.normalizer import normalize_title

    return CandidateTitle(id=id_, normalized_title=normalize_title(title), year=year, country=None)


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
