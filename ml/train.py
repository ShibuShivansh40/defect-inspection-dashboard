"""Fine-tune YOLOv8n on the NEU-DET subset, then export ONNX for in-browser inference.

Usage: python3 ml/train.py [--data /tmp/neu-yolo/data.yaml] [--epochs 80]
Needs: pip install ultralytics onnx onnxslim   (CPU is enough for this dataset size)
"""

import argparse
import json
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
IMGSZ = 224  # frames are 200x200; 224 is the nearest multiple of the model stride (32)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="/tmp/neu-yolo/data.yaml")
    ap.add_argument("--epochs", type=int, default=80)
    ap.add_argument("--weights", default="yolov8n.pt")
    ap.add_argument("--project", default="/tmp/train/runs")
    args = ap.parse_args()

    model = YOLO(args.weights)
    model.train(
        data=args.data, epochs=args.epochs, imgsz=IMGSZ, batch=16, workers=2, patience=30,
        seed=7, deterministic=True, project=args.project, name="neu-det", exist_ok=True, plots=False,
    )
    best = YOLO(f"{args.project}/neu-det/weights/best.pt")
    m = best.val(data=args.data, imgsz=IMGSZ, split="val", plots=False)
    names = best.names
    metrics = {
        "split": "held-out validation images (never seen in training)",
        "images": 48,
        "imgsz": IMGSZ,
        "map50": round(float(m.box.map50), 3),
        "map50_95": round(float(m.box.map), 3),
        "precision": round(float(m.box.mp), 3),
        "recall": round(float(m.box.mr), 3),
        "per_class_map50": {names[i]: round(float(v), 3) for i, v in zip(m.box.ap_class_index, m.box.ap50)},
    }
    (ROOT / "ml/metrics.json").write_text(json.dumps(metrics, indent=1) + "\n")
    print(json.dumps(metrics, indent=1))
    out = best.export(format="onnx", imgsz=IMGSZ, opset=17, simplify=True, dynamic=False)
    print("exported", out)


if __name__ == "__main__":
    main()
