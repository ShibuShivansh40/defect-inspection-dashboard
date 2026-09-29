"""Build a YOLO-format dataset from src/mocks/manifest.json with a stratified, seeded split.

Usage: python3 ml/prepare_dataset.py [--out /tmp/neu-yolo] [--val-per-class 8]
Writes <out>/images|labels/{train,val}, <out>/data.yaml and ml/split.json (which frames were held out).
"""

import argparse
import json
import random
import shutil
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASSES = ["crazing", "inclusion", "patches", "pitted_surface", "rolled_in_scale", "scratches"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/neu-yolo")
    ap.add_argument("--val-per-class", type=int, default=8)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    manifest = json.loads((ROOT / "src/mocks/manifest.json").read_text())
    by_class = defaultdict(list)
    for e in manifest:
        by_class[e["boxes"][0]["cls"] if e["boxes"] else "none"].append(e)

    rng = random.Random(args.seed)
    split = {"train": [], "val": []}
    for cls in sorted(by_class):
        items = sorted(by_class[cls], key=lambda e: e["id"])
        rng.shuffle(items)
        split["val"] += [e["id"] for e in items[: args.val_per_class]]
        split["train"] += [e["id"] for e in items[args.val_per_class :]]

    out = Path(args.out)
    shutil.rmtree(out, ignore_errors=True)
    for part in ("train", "val"):
        (out / "images" / part).mkdir(parents=True)
        (out / "labels" / part).mkdir(parents=True)
    ids = {e["id"]: e for e in manifest}
    for part, names in split.items():
        for name in names:
            e = ids[name]
            shutil.copy(ROOT / "public/frames" / e["file"], out / "images" / part / e["file"])
            lines = []
            for b in e["boxes"]:
                cx, cy = (b["x"] + b["w"] / 2) / e["width"], (b["y"] + b["h"] / 2) / e["height"]
                lines.append(
                    f"{CLASSES.index(b['cls'])} {cx:.6f} {cy:.6f} {b['w'] / e['width']:.6f} {b['h'] / e['height']:.6f}"
                )
            (out / "labels" / part / f"{name}.txt").write_text("\n".join(lines) + "\n")

    (out / "data.yaml").write_text(
        f"path: {out}\ntrain: images/train\nval: images/val\nnames:\n"
        + "".join(f"  {i}: {c}\n" for i, c in enumerate(CLASSES))
    )
    (ROOT / "ml/split.json").write_text(json.dumps(split, indent=1) + "\n")
    print({k: len(v) for k, v in split.items()}, "->", out)


if __name__ == "__main__":
    main()
