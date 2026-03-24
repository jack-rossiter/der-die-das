"""Extract German noun genders and merge English translations into a JSON file.

Sources:
  - german-nouns package (gender data, ~100k nouns from Wiktionary DE)
  - TU Chemnitz de-en dictionary (English translations, ~400k entries, GPL 2.0+)
"""

import gzip
import json
import os
import re
import urllib.request
from german_nouns.lookup import Nouns

OUTPUT_PATH = os.path.join("web", "data", "nouns.json")
DICT_URL = "https://ftp.tu-chemnitz.de/pub/Local/urz/ding/de-en-devel/de-en.txt.gz"
DICT_CACHE = os.path.join("web", "data", "de-en.txt.gz")

GENUS_COL = 2
GENUS1_COL = 3


def download_dictionary():
    """Download the TU Chemnitz dictionary if not already cached."""
    if os.path.exists(DICT_CACHE):
        print(f"Using cached dictionary: {DICT_CACHE}")
        return
    print(f"Downloading TU Chemnitz dictionary...")
    urllib.request.urlretrieve(DICT_URL, DICT_CACHE)
    print(f"Saved to {DICT_CACHE}")


def parse_translations():
    """Parse German→English noun translations from the TU Chemnitz dictionary.

    Returns dict mapping German lemma → first concise English translation.
    """
    translations = {}
    with gzip.open(DICT_CACHE, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "::" not in line:
                continue

            de_side, en_side = line.split("::", 1)

            de_parts = [p.strip() for p in de_side.split("|")]
            en_parts = [p.strip() for p in en_side.split("|")]

            for de_term, en_term in zip(de_parts, en_parts):
                # Match standalone nouns: "Haus {n}", "Katze {f} [zool.]"
                # The word must be followed by a gender tag or be the whole term.
                # This avoids matching compounds like "Haus-zu-Haus-Dienst".
                m = re.match(
                    r"^([A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+)*)"
                    r"\s*(?:\{[mfn]|$)",
                    de_term,
                )
                if not m:
                    continue
                word = m.group(1).strip()

                en_clean = re.sub(r"\s*\[.*?\]", "", en_term).strip()
                en_clean = re.sub(r"\s*\{.*?\}", "", en_clean).strip()
                en_clean = re.sub(r"\s*\(.*?\)", "", en_clean).strip()
                en_clean = en_clean.split(";")[0].strip()

                if en_clean and word not in translations:
                    translations[word] = en_clean

    return translations


def build():
    nouns = Nouns()
    gender_map = {}

    for row in nouns.data:
        lemma = row[0]
        if not lemma or lemma.startswith("-"):
            continue
        genus = row[GENUS_COL] or row[GENUS1_COL]
        if genus in ("m", "f", "n"):
            gender_map[lemma] = genus

    print(f"Extracted {len(gender_map)} nouns with gender")

    download_dictionary()
    translations = parse_translations()
    print(f"Parsed {len(translations)} translations from TU Chemnitz dictionary")

    matched = 0
    result = {}
    for lemma, genus in gender_map.items():
        en = translations.get(lemma)
        if en:
            matched += 1
            result[lemma] = [genus, en]
        else:
            result[lemma] = [genus]

    print(f"Translations matched: {matched} / {len(gender_map)} ({100*matched/len(gender_map):.1f}%)")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fp:
        json.dump(result, fp, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"Wrote {len(result)} nouns to {OUTPUT_PATH} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    build()
