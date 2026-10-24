import hashlib
import os
import re
from collections import Counter
from pathlib import Path

import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "SMART-OM"
OUT = ROOT / "data" / "splits"
CLASS_DIR = {
    "01. Normal": 0,
    "02. Variation from normal": 1,
    "03. OPMD": 2,
    "04. Oral Cancer": 3,
}
SENIORITY = {
    "01. Normal": 0,
    "02. Variation from normal": 1,
    "03. OPMD": 2,
    "04. Oral Cancer": 3,
}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
COLUMNS = ["path", "label", "subject_id", "patient_known", "filename"]
SEED = 42


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def smita_pid(filename):
    match = re.match(r"(SMITA\d+)", Path(filename).stem, re.IGNORECASE)
    return int(match.group(1)[5:]) if match else None


def anon_pid(filename):
    match = re.search(r"(\d+)", Path(filename).stem)
    return int(match.group(1)) if match else None


def contains_dot_path(relative_path):
    return any(part.startswith(".") for part in relative_path.parts)


def collect_rows():
    rows = []
    for cls_dir, label in sorted(CLASS_DIR.items(), key=lambda item: item[1]):
        base = RAW / cls_dir / "01. Unannotated"
        if not base.is_dir():
            raise SystemExit(f"missing unannotated directory: {base}")
        for root, dirs, files in os.walk(base):
            dirs[:] = sorted(directory for directory in dirs if not directory.startswith("."))
            for filename in sorted(files):
                path = Path(root) / filename
                relative = path.relative_to(RAW)
                if filename.startswith(".") or contains_dot_path(relative) or path.suffix.lower() not in IMAGE_EXTS:
                    continue
                rows.append({
                    "path": path.relative_to(ROOT).as_posix(),
                    "label": label,
                    "cls_dir": cls_dir,
                    "filename": filename,
                })
    if not rows:
        raise SystemExit(f"no supported images found under {RAW}")
    return pd.DataFrame(rows)


def stable_class_coverage(source, splits):
    expected = source.groupby("label").size().sort_index()
    actual = pd.concat([split["label"] for split in splits]).value_counts().reindex(expected.index, fill_value=0).sort_index()
    assert expected.equals(actual), f"class coverage changed: expected={expected.to_dict()} actual={actual.to_dict()}"
    for name, split in zip(("train", "val", "test"), splits):
        assert not split.empty, f"{name} split is empty"
        assert set(split["label"]) == set(expected.index), f"{name} class coverage is unstable: {split['label'].value_counts().sort_index().to_dict()}"


def group_split(frame, k, seed=SEED):
    splitter = StratifiedGroupKFold(n_splits=k, shuffle=True, random_state=seed)
    train_indices, holdout_indices = next(splitter.split(frame, frame["label"], frame["subject_id"]))
    return frame.iloc[train_indices].copy(), frame.iloc[holdout_indices].copy()


def main():
    frame = collect_rows()
    frame["_md5"] = frame["path"].map(lambda path: md5(ROOT / path))
    frame["_sen"] = frame["cls_dir"].map(SENIORITY)
    frame = (
        frame.sort_values(["label", "path"], kind="stable")
        .drop_duplicates("_md5", keep="first")
        .drop(columns=["_md5", "_sen", "cls_dir"])
        .reset_index(drop=True)
    )

    known_pid = frame["filename"].map(smita_pid)
    frame["patient_known"] = known_pid.notna().astype(int)
    anonymous = ~known_pid.notna()
    frame["subject_id"] = ""
    frame.loc[~anonymous, "subject_id"] = "P" + known_pid.loc[~anonymous].astype(int).astype(str)
    anonymous_token = frame.loc[anonymous, "filename"].map(anon_pid)
    frame.loc[anonymous, "subject_id"] = "A" + anonymous_token.astype("Int64").astype(str)
    assert not (frame.loc[anonymous, "subject_id"] == "A<NA>").any(), "anonymous filename without integer"

    counts = Counter(frame["patient_known"])
    print(f"after dedup: {len(frame)} known-patient={counts[1]} anonymous={counts[0]}")

    known = frame[frame["patient_known"] == 1].copy()
    anonymous_frame = frame[frame["patient_known"] == 0].copy()
    if known.empty:
        raise SystemExit("no known SMART-OM patients found")
    trainval, test = group_split(known, 7)
    train, val = group_split(trainval, 6)
    train = pd.concat([train, anonymous_frame], ignore_index=True)

    assert not set(train["subject_id"]) & set(test["subject_id"])
    assert not set(train["subject_id"]) & set(val["subject_id"])
    assert not set(val["subject_id"]) & set(test["subject_id"])
    assert (test["patient_known"] == 1).all()
    assert (val["patient_known"] == 1).all()
    assert (train.loc[train["patient_known"] == 0, "subject_id"].str.startswith("A")).all()
    assert train["path"].is_unique and val["path"].is_unique and test["path"].is_unique
    stable_class_coverage(frame, (train, val, test))

    for name, split in (("train", train), ("val", val), ("test", test)):
        counts = split["label"].value_counts().reindex(range(4), fill_value=0)
        print(
            f"{name}: n={len(split)} patients={split['subject_id'].nunique()} "
            f"healthy={counts[0]} variation={counts[1]} opmd={counts[2]} oc={counts[3]}"
        )

    OUT.mkdir(parents=True, exist_ok=True)
    for name, split in (("train", train), ("val", val), ("test", test)):
        split[COLUMNS].to_csv(OUT / f"{name}.csv", index=False)
    print(f"saved -> {OUT}")


if __name__ == "__main__":
    main()
