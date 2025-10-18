"use client";

import { useState, ChangeEvent } from "react";

const MAX_SIDE_PX = 1024;   // shrink longest side to this
const JPEG_QUALITY = 0.7;   // 0..1 for toDataURL

async function compressImage(file: File, maxSide = MAX_SIDE_PX, quality = JPEG_QUALITY): Promise<string> {
  // read file → dataURL
  const dataURL: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  // draw to canvas (resize preserving aspect)
  const img = document.createElement("img");
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Failed to load image for compression"));
    img.src = dataURL;
  });

  let { width, height } = img;
  if (width > height && width > maxSide) {
    height = (height * maxSide) / width;
    width = maxSide;
  } else if (height >= width && height > maxSide) {
    width = (width * maxSide) / height;
    height = maxSide;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // export as JPEG (much smaller than PNG)
  const out = canvas.toDataURL("image/jpeg", quality); // "data:image/jpeg;base64,...."
  return out.split(",")[1]; // return pure base64 payload
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);     // preview (data URL)
  const [result, setResult] = useState<string | null>(null);   // base64 result (no prefix)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // compress to stay under Vercel body limits
      const base64 = await compressImage(file);
      const approxBytes = (base64.length * 3) / 4;
      if (approxBytes > 4_000_000) {
        throw new Error("Image is still too large after compression. Try a smaller photo.");
      }

      // show preview of compressed image
      setImage(`data:image/jpeg;base64,${base64}`);

      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
      }

      const data: { result: string } = await res.json();
      setResult(data.result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-6">Cockroach Detection</h1>

      <input type="file" accept="image/*" onChange={handleUpload} />

      {loading && <p className="mt-4">Analyzing image...</p>}
      {error && <p className="mt-2 text-red-600">Error: {error}</p>}

      <div className="flex flex-col md:flex-row mt-6 gap-6">
        {image && (
          <div>
            <h2 className="text-xl mb-2">Original (compressed)</h2>
            <img
              src={image}
              alt="Uploaded image"
              className="max-w-sm rounded shadow-md"
            />
          </div>
        )}
        {result && (
          <div>
            <h2 className="text-xl mb-2">Detections</h2>
            <img
              src={`data:image/png;base64,${result}`}
              alt="Detection result"
              className="max-w-sm rounded shadow-md"
            />
          </div>
        )}
      </div>
    </main>
  );
}
