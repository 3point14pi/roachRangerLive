import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    const buffer = Buffer.from(image, "base64");

    // Save the image temporarily
    const tempDir = path.join(process.cwd(), "tmp");
    const inputPath = path.join(tempDir, "input.png");
    const outputDir = path.join(tempDir, "runs/detect");

    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(inputPath, buffer);

    // Run YOLO CLI (assuming your weights are in /models/cockroach_detection.pt)
    await new Promise((resolve, reject) => {
      const proc = spawn("npx", [
        "yolo",
        "detect",
        "predict",
        "--weights",
        "models/cockroach_detection.pt",
        "--source",
        inputPath,
        "--save",
        "--conf",
        "0.5"
      ]);

      proc.on("close", (code) => {
        code === 0 ? resolve(true) : reject(new Error(`YOLO exited ${code}`));
      });
    });

    // Grab the predicted image (YOLO saves to runs/detect/predict/input.png)
    const predPath = path.join(outputDir, "predict", "input.png");
    if (!fs.existsSync(predPath))
      return NextResponse.json({ error: "No prediction output" }, { status: 500 });

    const resultBuffer = fs.readFileSync(predPath);
    const resultBase64 = resultBuffer.toString("base64");

    return NextResponse.json({ result: resultBase64 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
