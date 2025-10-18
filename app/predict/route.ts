// app/api/predict/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runYOLO(inputPath: string, weightsPath: string) {
  const projectDir = "/tmp";
  const runName = "predict";
  const outDir = path.join(projectDir, runName);

  // Clean old outputs (ignore errors)
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch (e) {
    // ignore
  }

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
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`YOLO exited with ${code}`));
      }
    });
  });

  const predictedPath = path.join(outDir, path.basename(inputPath));
  if (!fs.existsSync(predictedPath)) {
    throw new Error("Prediction output not found");
  }
  return predictedPath;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const base64: string | undefined = body?.image;
    if (!base64) {
      return NextResponse.json({ error: "Missing 'image' base64" }, { status: 400 });
    }

    const tmpDir = "/tmp";
    const inputPath = path.join(tmpDir, "input.png");
    const weightsPath = path.join(process.cwd(), "models", "cockroach_detection.pt");

    if (!fs.existsSync(weightsPath)) {
      return NextResponse.json({ error: "Model weights not found on server" }, { status: 500 });
    }

    fs.writeFileSync(inputPath, Buffer.from(base64, "base64"));

    const predictedPath = await runYOLO(inputPath, weightsPath);
    const resultB64 = fs.readFileSync(predictedPath).toString("base64");

    return NextResponse.json({ result: resultB64 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
