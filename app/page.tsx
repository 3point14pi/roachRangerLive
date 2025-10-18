"use client";
import { useState } from "react";

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result?.toString().split(",")[1];
      if (!base64) return;
      setLoading(true);

      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await response.json();
      setResult(data.result);
      setImage(reader.result?.toString() || null);
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-6">Cockroach Detection</h1>
      <input type="file" accept="image/*" onChange={handleUpload} />
      {loading && <p className="mt-4">Analyzing image...</p>}
      <div className="flex flex-col md:flex-row mt-6 gap-6">
        {image && (
          <div>
            <h2 className="text-xl mb-2">Original</h2>
            <img src={image} className="max-w-sm rounded" />
          </div>
        )}
        {result && (
          <div>
            <h2 className="text-xl mb-2">Detections</h2>
            <img
              src={`data:image/png;base64,${result}`}
              className="max-w-sm rounded"
            />
          </div>
        )}
      </div>
    </main>
  );
}
