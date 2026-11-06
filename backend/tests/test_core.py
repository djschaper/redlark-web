from redlark.core.chordpro import parse_chordpro, song_to_chordpro
from redlark.core.chords import parse_key, transpose_chord, transposition_change
from redlark.core.lyrics import clean_lyric, lyrics_only
from redlark.core.opensong import (
    parse_header,
    parse_lyrics,
    parse_set_xml,
    parse_song_xml,
    sections_to_lyrics,
    set_to_xml,
    song_to_xml,
    transpose_song,
)


def test_transpose_cases(chord_cases):
    for c in chord_cases["transpose"]:
        assert transpose_chord(c["chord"], c["change"]) == c["expected"], c
    for c in chord_cases["change"]:
        assert transposition_change(c["from"], c["to"]) == c["expected"], c


def test_parse_key():
    assert parse_key("A#") == "Bb"
    assert parse_key(" Em ") == "Em"


def test_headers():
    assert parse_header("C1b") == ("chorus", "Chorus 1b")
    assert parse_header("V2") == ("verse", "Verse 2")
    assert parse_header("Verse 2") == ("verse", "Verse 2")
    assert parse_header("P") == ("pre-chorus", "Pre-Chorus")
    assert parse_header("Turnaround 1") == ("turnaround", "Turnaround 1")
    assert parse_header("Instrumental") == ("instrumental", "Instrumental")


def test_song_xml_roundtrip(reasons_xml):
    song = parse_song_xml(reasons_xml)
    assert song.title == "10,000 Reasons (Bless The Lord)"
    assert song.key == "D" and song.tempo == "73" and song.ccli == "6016351"
    assert song.extra["keyoriginal"] == "G"
    again = parse_song_xml(song_to_xml(song))
    assert again == song


def test_chord_anchoring(reasons_xml):
    sections = parse_lyrics(parse_song_xml(reasons_xml).lyrics)
    assert [s.label for s in sections][:3] == ["Chorus 1", "Verse 1", "Verse 2"]
    assert sections[0].indented
    first = sections[0].lines[0].segments
    assert [(s.chord, s.lyric) for s in first if s.chord][:2] == [("G", "Lord"), ("D", "soul")]
    instrumental = next(s for s in sections if s.label == "Instrumental")
    assert instrumental.lines[0].has_chords and not instrumental.lines[0].lyric_text.strip()


def test_sections_to_lyrics_stable(reasons_xml):
    sections = parse_lyrics(parse_song_xml(reasons_xml).lyrics)
    text = sections_to_lyrics(sections)
    assert sections_to_lyrics(parse_lyrics(text)) == text


def test_transpose_song(reasons_xml):
    song = transpose_song(parse_song_xml(reasons_xml), "G")
    assert song.key == "G"
    first = parse_lyrics(song.lyrics)[0].lines[0].segments
    assert [s.chord for s in first if s.chord] == ["C", "G", "D/F#", "Em"]


def test_lyrics_only(reasons_xml):
    sections = lyrics_only(parse_lyrics(parse_song_xml(reasons_xml).lyrics))
    assert "Instrumental" not in [s.label for s in sections]
    assert sections[0].lines[2].lyric_text == "Sing like never before O my soul"
    assert clean_lyric("Ten thousand years and then for - ev - er - more") == (
        "Ten thousand years and then forevermore"
    )


def test_chordpro_import(fixtures):
    song = parse_chordpro((fixtures / "songs" / "Simple.cho").read_text())
    assert (song.title, song.author, song.key, song.tempo) == ("Simple Song", "Test Writer", "G", "80")
    sections = parse_lyrics(song.lyrics)
    assert [s.label for s in sections] == ["Verse 1", "Chorus", "Verse 2", "Chorus", "Instrumental"]
    assert [s.kind for s in sections][:2] == ["verse", "chorus"]
    v1 = sections[0].lines[0]
    assert [(s.chord, s.lyric.strip()) for s in v1.segments if s.chord][:2] == [("G", "Amazing"), ("C", "grace")]
    assert sections[2].lines[1].kind == "comment"
    assert lyrics_only(sections)[0].lines[1].lyric_text == "That saved a wretch like me"


def test_chordpro_export_roundtrip(reasons_xml):
    song = parse_song_xml(reasons_xml)
    cho = song_to_chordpro(song)
    assert "{start_of_chorus: Chorus 1}" in cho
    assert "Sing like [G]never be - [Bm]fore" in cho
    back = parse_chordpro(cho)
    a = [ln.lyric_text for s in lyrics_only(parse_lyrics(song.lyrics)) for ln in s.lines]
    b = [ln.lyric_text for s in lyrics_only(parse_lyrics(back.lyrics)) for ln in s.lines]
    assert a == b


def test_set_xml_roundtrip():
    xml = (
        '<set><slide_groups><slide_group name="Behold Our God" type="song" presentation="" path="/" key="Bb"/>'
        '<slide_group name="Speak O Lord" type="song" presentation="" path="/" key="C"/></slide_groups></set>'
    )
    s = parse_set_xml(xml, "2026-10-25")
    assert [(i.name, i.key) for i in s.items] == [("Behold Our God", "Bb"), ("Speak O Lord", "C")]
    again = parse_set_xml(set_to_xml(s), "2026-10-25")
    assert again == s
