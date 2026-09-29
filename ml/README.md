# Model training

The dashboard's detections come from a YOLOv8n model fine-tuned on the NEU-DET subset in `public/frames/`.

```bash
pip install ultralytics onnx onnxslim onnxruntime

python3 ml/prepare_dataset.py        # stratified, seeded split -> /tmp/neu-yolo, writes ml/split.json
python3 ml/train.py --epochs 80      # fine-tunes yolov8n.pt, writes ml/metrics.json, exports ONNX
cp /tmp/train/runs/neu-det/weights/best.onnx public/models/defect-yolov8n.onnx
python3 ml/predict.py                # replays held-out frames -> src/mocks/predictions.json
```

- **Split:** 192 training images and 48 held-out images (8 per class). `split.json` lists which is which.
- **Held-out only:** the dashboard's simulated line shows only the 48 held-out frames, so every box you see is an
  out-of-sample prediction.
- **Metrics:** `metrics.json` is computed on the held-out images only. Treat it as a small-sample estimate.
- **Retraining on your own labels:** export a YOLO zip from the Labeling Studio, unzip it, and pass its
  `data.yaml` with `--data`.
