import json
import pathlib

import pytest

FIXTURES = pathlib.Path(__file__).resolve().parents[2] / "shared" / "fixtures"


@pytest.fixture
def fixtures() -> pathlib.Path:
    return FIXTURES


@pytest.fixture
def chord_cases():
    return json.loads((FIXTURES / "chords.json").read_text())


@pytest.fixture
def reasons_xml(fixtures):
    return (fixtures / "songs" / "10,000 Reasons (Bless The Lord)").read_bytes()
