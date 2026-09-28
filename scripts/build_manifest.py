"""Parse NEU-DET Pascal VOC XML files into src/mocks/manifest.json.

Usage: python3 scripts/build_manifest.py
Reads scripts/annotations/*.xml for every image present in public/frames/.
"""

import json
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "public" / "frames"
ANNOTATIONS = ROOT / "scripts" / "annotations"
OUT = ROOT / "src" / "mocks" / "manifest.json"

# XML class names -> the DefectClass union in src/types.ts
CLASS_MAP = {
    "crazing": "crazing",
    "inclusion": "inclusion",
    "patches": "patches",
    "pitted_surface": "pitted_surface",
    "rolled-in_scale": "rolled_in_scale",
    "scratches": "scratches",
}


def parse(xml_path: Path) -> dict:
    root = ET.parse(xml_path).getroot()
    size = root.find("size")
    width = int(size.findtext("width"))
    height = int(size.findtext("height"))
    boxes = []
    for obj in root.iter("object"):
        name = obj.findtext("name").strip()
        cls = CLASS_MAP.get(name)
        if cls is None:
            raise ValueError(f"{xml_path.name}: unknown class {name!r}")
        bb = obj.find("bndbox")
        xmin, ymin = int(float(bb.findtext("xmin"))), int(float(bb.findtext("ymin")))
        xmax, ymax = int(float(bb.findtext("xmax"))), int(float(bb.findtext("ymax")))
        boxes.append({"cls": cls, "x": xmin, "y": ymin, "w": xmax - xmin, "h": ymax - ymin})
    return {"width": width, "height": height, "boxes": boxes}


def main() -> None:
    entries = []
    for img in sorted(FRAMES.glob("*.jpg")):
        xml_path = ANNOTATIONS / f"{img.stem}.xml"
        if not xml_path.exists():
            print(f"skip {img.name}: no annotation")
            continue
        entries.append({"id": img.stem, "file": img.name, **parse(xml_path)})
    OUT.write_text(json.dumps(entries, separators=(",", ":")))
    print(f"wrote {len(entries)} entries to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
