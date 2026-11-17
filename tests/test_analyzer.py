from tests.conftest import ML_RESUME, CHEF_RESUME, ML_JD


def test_skill_gap_finds_overlap_and_missing(analyzer):
    g = analyzer.skill_gap(ML_RESUME, ML_JD)
    assert "Python" in g["matched"] and "Pandas" in g["matched"]
    assert any(m["skill"] == "PyTorch" for m in g["missing"])
    assert 0 < g["coverage"] < 1


def test_match_score_prefers_relevant_resume(analyzer):
    good = analyzer.match_score(ML_RESUME, ML_JD)["score"]
    bad = analyzer.match_score(CHEF_RESUME, ML_JD)["score"]
    assert good > bad + 20


def test_ats_score_rewards_complete_resume(analyzer):
    full = analyzer.ats_score(ML_RESUME)["score"]
    stub = analyzer.ats_score("Experienced worker looking for a job. " * 8)["score"]
    assert full > stub


def test_category_prediction_shape(analyzer):
    out = analyzer.predict_category(ML_RESUME, top_k=5)
    assert len(out["top"]) == 5
    confs = [t["confidence"] for t in out["top"]]
    assert confs == sorted(confs, reverse=True)
    assert all(0 <= c <= 1 for c in confs)


def test_chef_resume_predicts_chef(analyzer):
    assert analyzer.predict_category(CHEF_RESUME)["top"][0]["category"] == "CHEF"


def test_analyze_with_and_without_jd(analyzer):
    a = analyzer.analyze(ML_RESUME, ML_JD)
    b = analyzer.analyze(ML_RESUME)
    assert "match" in a and "match" not in b and "skills" in b
