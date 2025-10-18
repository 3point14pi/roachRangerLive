# api/predict.py
from http.server import BaseHTTPRequestHandler
import json, base64, io, os
from PIL import Image
import numpy as np
from ultralytics import YOLO

MODEL_PATH = os.environ.get("YOLO_MODEL_PATH", "models/cockroach_detection.pt")
yolo_model = YOLO(MODEL_PATH)

def predict_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes))
    results = yolo_model.predict(image, conf=0.5, save=False)
    result_img = results[0].plot()  # draw boxes
    output = io.BytesIO()
    Image.fromarray(result_img).save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode()

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers["Content-Length"])
        body = self.rfile.read(content_length)
        data = json.loads(body)
        image_bytes = base64.b64decode(data.get("image"))
        result_b64 = predict_image(image_bytes)

        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"result": result_b64}).encode())
