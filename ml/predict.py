"""Run the trained detector on the held-out frames and write src/mocks/predictions.json.

The dashboard's mock edge API replays these real predictions, so the boxes and confidences it shows come
from the model, not from a random number generator. Only frames the model never trained on are used.

Usage: python3 ml/predict.py [--weights /tmp/train/runs/neu-det/weights/best.pt] [--conf 0.25]
"""

import argparse
import json
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
CLASSES = ["crazing", "inclusion", "patches", "pitted_surface", "rolled_in_scale", "scratches"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default="/tmp/train/runs/neu-det/weights/best.pt")
    ap.add_argument("--conf", type=float, default=0.25)
    args = ap.parse_args()

    split = json.loads((ROOT / "ml/split.json").read_text())
    manifest = {e["id"]: e for e in json.loads((ROOT / "src/mocks/manifest.json").read_text())}
    metrics = json.loads((ROOT / "ml/metrics.json").read_text())
    model = YOLO(args.weights)

    frames = {}
    for frame_id in split["val"]:
        entry = manifest[frame_id]
        res = model.predict(ROOT / "public/frames" / entry["file"], imgsz=224, conf=args.conf, iou=0.45, verbose=False)[0]
        dets = []
        for box in res.boxes:
            x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
            dets.append(
                {
                    "cls": CLASSES[int(box.cls[0])],
                    "confidence": round(float(box.conf[0]), 2),
                    "x": round(x1),
                    "y": round(y1),
                    "w": round(x2 - x1),
                    "h": round(y2 - y1),
                }
            )
        frames[frame_id] = sorted(dets, key=lambda d: -d["confidence"])

    out = {
        "model": {
            "name": "YOLOv8n fine-tuned on a NEU-DET subset",
            "note": "Predictions on held-out frames only (never seen in training).",
            "minConfidence": args.conf,
            "metrics": {k: metrics[k] for k in ("map50", "map50_95", "precision", "recall", "images")},
        },
        "frames": frames,
    }
    path = ROOT / "src/mocks/predictions.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    n = sum(len(v) for v in frames.values())
    empty = sum(1 for v in frames.values() if not v)
    print(f"wrote {len(frames)} frames, {n} detections, {empty} frames with none -> {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
