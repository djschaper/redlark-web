"""Gotchas found while building the standalone ChordPro <-> OpenSong converters (Dec 2025).

Each test uses the exact example that exposed the bug back then.
"""

import xml.etree.ElementTree as ET

from redlark.core.chordpro import parse_chordpro, song_to_chordpro
from redlark.core.model import Song
from redlark.core.opensong import parse_lyrics, parse_song_xml, sections_to_lyrics, song_to_xml
from redlark.exchange import read_upload


def lyric_lines(song: Song) -> list[str]:
    return song.lyrics.split("\n")


def chordpro_body(*lines: str) -> str:
    return "{title: Test}\n" + "\n".join(lines) + "\n"


# --- Section labels -------------------------------------------------------------------------


def test_section_labels_are_abbreviated():
    song = parse_chordpro(
        chordpro_body(
            "{comment: Verse 1}",
            "a",
            "",
            "{comment: Chorus}",
            "b",
            "",
            "{comment: Pre-Chorus}",
            "c",
            "",
            "{comment: Bridge}",
            "d",
            "",
            "{comment: Intro}",
            "e",
            "",
            "{comment: Tag}",
            "f",
            "",
            "{comment: Ending}",
            "g",
            "",
            "{comment: Pre Chorus 2}",
            "h",
        )
    )
    headers = [ln for ln in lyric_lines(song) if ln.startswith("[")]
    assert headers == ["[V1]", "[C]", "[P]", "[B]", "[I]", "[T]", "[E]", "[P2]"]


def test_unrecognised_section_names_are_kept():
    song = parse_chordpro(chordpro_body("{comment: Instrumental}", "[G]", "", "{comment: Turnaround 2}", "[C]"))
    headers = [ln for ln in lyric_lines(song) if ln.startswith("[")]
    assert headers == ["[Instrumental]", "[Turnaround 2]"]


# --- Chord / lyric alignment ----------------------------------------------------------------


def converted_pair(chordpro_line: str) -> tuple[str, str]:
    lines = lyric_lines(parse_chordpro(chordpro_body("{comment: Verse 1}", chordpro_line)))
    i = next(i for i, ln in enumerate(lines) if ln.startswith("."))
    return lines[i], lines[i + 1]


def test_adjacent_chords_are_separated_by_a_space():
    chords, _ = converted_pair("[C]   Let me be [G]singing when the [Dsus]eve - [D]ning  [G]comes   [C/G]  [G]")
    assert "C/G G" in chords and "C/GG" not in chords


def test_spacing_added_between_chords_is_added_to_the_lyrics_too():
    assert converted_pair("[D]Lord  [Gm]Sab - [D]a - [Gm/Bb]oth  [C]His [F]name") == (
        ".D     Gm    D   Gm/Bb C   F",
        " Lord  Sab - a - oth   His name",
    )


def test_chord_stays_over_the_start_of_its_syllable():
    assert converted_pair("[Bb] Our helper [Fsus]He  [Dm]a - [Gm]mid  [C]the  [F]flood") == (
        ".Bb          Fsus Dm  Gm   C    F",
        "  Our helper He   a - mid  the  flood",
    )


# --- Chord-only lines -----------------------------------------------------------------------


def test_chord_only_line_gets_a_lyric_line_of_spaces_as_long_as_the_chord_line():
    song = parse_chordpro(chordpro_body("{comment: Ending}", "[|] [C] [.]  [F/C] [|] [C]            [|]"))
    lines = lyric_lines(song)
    assert lines[0] == "[E]"
    assert lines[1] == ".| C . F/C | C           |"
    assert lines[2] == " " + " " * (len(lines[1]) - 1)


def test_trailing_spaces_survive_the_xml_at_the_end_of_lyrics():
    song = parse_chordpro(chordpro_body("{comment: Ending}", "[|] [C] [.]  [F/C] [|] [C]            [|]"))
    xml = song_to_xml(song)
    assert ".| C . F/C | C           |\n" + " " * 26 + "</lyrics>" in xml
    assert parse_song_xml(xml).lyrics == song.lyrics


# --- CCLI footer ------------------------------------------------------------------------------

SONGSELECT_ENDING = """{title: 10,000 Reasons (Bless the Lord)}
{comment: Ending}
Sing like [C]never be - [Em]fore   [C]O  [D]my [Em]soul
I’ll [C]worship Your [D]holy    [Em]name
[C]Worship Your [D]holy    [Em]name
[C]Worship Your [D]holy    [G]name


CCLI Song # 6016351
© 2011 Atlas Mountain Songs | sixsteps Music | Thankyou Music Ltd | worshiptogether.com songs
For use solely with the SongSelect® Terms of Use. All rights reserved. www.ccli.com
CCLI License # 22660814
"""


def test_ccli_footer_is_removed_and_its_details_kept():
    song = parse_chordpro(SONGSELECT_ENDING)
    assert "CCLI" not in song.lyrics and "SongSelect" not in song.lyrics
    assert lyric_lines(song)[-1].strip() == "Worship Your holy    name"
    assert song.ccli == "6016351"
    assert song.copyright.startswith("2011 Atlas Mountain Songs")


def test_ccli_footer_removal_keeps_a_trailing_chord_only_line():
    text = chordpro_body("{comment: Ending}", "[|] [C] [.]  [F/C] [|] [C]            [|]", " ", "", "CCLI Song # 1")
    lines = lyric_lines(parse_chordpro(text))
    assert lines[-2] == ".| C . F/C | C           |"
    assert lines[-1] == " " * 26


def test_ccli_text_without_two_blank_lines_is_not_a_footer():
    song = parse_chordpro(chordpro_body("{comment: Verse 1}", "CCLI is mentioned in this lyric"))
    assert "CCLI is mentioned" in song.lyrics


# --- Metadata ---------------------------------------------------------------------------------


def test_multiple_artists_join_with_pipes_and_split_back():
    song = parse_chordpro(
        "{title: A Mighty Fortress}\n{artist: Martin Luther}\n{artist: Translated by Frederick Henry Hedge}\n"
        "{artist: Arranged by Tommy Walker}\n"
    )
    assert song.author == "Martin Luther | Translated by Frederick Henry Hedge | Arranged by Tommy Walker"
    cho = song_to_chordpro(song)
    assert (
        "{artist: Martin Luther}\n{artist: Translated by Frederick Henry Hedge}\n{artist: Arranged by Tommy Walker}"
        in cho
    )


def test_new_opensong_files_have_every_standard_tag():
    root = ET.fromstring(song_to_xml(parse_chordpro(chordpro_body("a"))))
    tags = {el.tag for el in root}
    for tag in (
        "title author copyright presentation hymn_number capo tempo time_sig duration predelay ccli theme "
        "alttheme key aka key_line books midi midi_index pitch restrictions notes lyrics linked_songs pad_file "
        "custom_chords link_youtube link_web link_audio loop_audio link_other abcnotation"
    ).split():
        assert tag in tags, tag


def test_txt_files_are_accepted_as_chordpro():
    found = read_upload([("Plain Song.txt", b"[G]Amazing [C]grace\nhow sweet the sound\n")])
    assert [(c.format, c.title) for c in found] == [("chordpro", "Plain Song")]


# --- Lossless round trips -------------------------------------------------------------------


def test_opensong_to_chordpro_and_back_is_lossless(reasons_xml):
    song = parse_song_xml(reasons_xml)
    song.extra["hymn_number"] = "42"
    song.notes = "Line one\nLine two"
    back = parse_chordpro(song_to_chordpro(song))
    for field in ("title", "author", "copyright", "ccli", "key", "tempo", "time_sig", "notes", "uuid"):
        assert getattr(back, field) == getattr(song, field), field
    assert back.extra["hymn_number"] == "42" and back.extra["keyoriginal"] == "G"

    # Lyrics: same sections, same chords at the same columns, same lyric text (incl. "be - fore").
    def shape(text):
        return [
            (
                s.label,
                [
                    [
                        (g.chord, g.lyric.rstrip() if i == len(ln.segments) - 1 else g.lyric)
                        for i, g in enumerate(ln.segments)
                    ]
                    for ln in s.lines
                ],
            )
            for s in parse_lyrics(text)
        ]

    assert shape(back.lyrics) == shape(sections_to_lyrics(parse_lyrics(song.lyrics)))


def test_chord_only_lines_export_as_inline_chords_and_keep_their_columns():
    lyrics = "[E]\n.| C . F/C | C           |\n" + " " * 26
    cho = song_to_chordpro(Song(title="T", lyrics=lyrics))
    assert "[|]  [C]  [.]  [F/C]    [|]  [C]            [|]" in cho
    assert parse_chordpro(cho).lyrics == lyrics


def test_syllable_hyphens_are_kept_in_chordpro_export(reasons_xml):
    assert "Sing like [G]never be - [Bm]fore" in song_to_chordpro(parse_song_xml(reasons_xml))
