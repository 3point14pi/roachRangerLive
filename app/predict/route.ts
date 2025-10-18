// app/api/predict/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";          // ensure Node (not Edge)
export const dynamic = "force-dynamic";   // because we touch the filesystem
export const maxDuration = 60;            // Vercel serverless timeout (seconds)

async function runYOLO(inputPath: string, weightsPath: string) {
  // Write outputs to /tmp/predict so we know exactly where to read from
  const projectDir = "/tmp";
  const runName = "predict";
  const outDir = path.join(projectDir, "predict");

  // Clean old outputs if any
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "npx",
      [
        "yolo",
        "detect",
        "predict",
        "--weights",
        weightsPath,
        "--source",
        inputPath,
        "--save",
        "--project",
        projectDir,
        "--name",
        runName,
        "--conf",
        "0.5",
      ],
      { stdio: "inherit" }
    );

    proc.on("close", (code) => {
      code === 0 ? resolve() : reject(new Error(`YOLO exited with ${code}`));
    });
  });

  // YOLO saves to /tmp/predict/input.png (same filename as input)
  const predictedPath = path.join(outDir, path.basename(inputPath));
  if (!fs.existsSync(predictedPath)) {
    throw new Error("Prediction output not found");
  }
  return predictedPath;
}

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "Missing 'image' base64" }, { status: 400 });
    }

    // Save input to /tmp
    const tmpDir = "/tmp";
    const inputPath = path.join(tmpDir, "input.png");
    const weightsPath = path.join(process.cwd(), "models", "cockroach_detection.pt");

    // Make sure model exists
    if (!fs.existsSync(weightsPath)) {
      return NextResponse.json({ error: "Model weights not found on server" }, { status: 500 });
    }

    const buf = Buffer.from(image, "base64");
    fs.writeFileSync(inputPath, buf);

    const predictedPath = await runYOLO(inputPath, weightsPath);
    const resultB64 = fs.readFileSync(predictedPath).toString("base64");

    return NextResponse.json({ result: resultB64 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
