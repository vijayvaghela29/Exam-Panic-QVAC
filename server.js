const express = require("express");
const path = require("path");

const {
  loadModel,
  completion,
  unloadModel,
  LLAMA_3_2_1B_INST_Q4_0
} = require("@qvac/sdk");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let modelId = null;
let loading = false;

async function getModel() {
  if (modelId) {
    return modelId;
  }

  if (loading) {
    throw new Error("QVAC model is still loading. Please wait.");
  }

  loading = true;

  try {
    console.log("Loading QVAC model...");

    modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,

      onProgress: (progress) => {
        if (progress && typeof progress.percentage === "number") {
          console.log(
            `QVAC model: ${progress.percentage.toFixed(0)}%`
          );
        }
      }
    });

    console.log("Exam Panic is ready to create local study plans locally.");

    return modelId;

  } finally {
    loading = false;
  }
}

app.get("/api/status", (req, res) => {
  res.json({
    app: "Exam Panic",
    loaded: !!modelId,
    loading,
    onDevice: true
  });
});

app.post("/api/plan", async (req, res) => {
  try {
    const { topics, hours, level } = req.body;

    if (!topics || !hours) {
      return res.status(400).json({
        error: "Topics and available hours are required."
      });
    }

    const id = await getModel();

    const prompt = `
You are Exam Panic, an expert exam study planner.

Create a practical study plan for a student.

Preparation level: ${level}
Available study time: ${hours} hours

Topics:
${topics}

Requirements:
1. Prioritize the most important topics.
2. Divide the available time realistically.
3. Include short breaks.
4. Include active revision.
5. Include practice questions.
6. Keep the plan practical and easy to follow.
7. Do not invent topics that were not provided.
8. Use clear headings and bullet points.

Return only the final study plan.
`;

    const run = completion({
      modelId: id,
      history: [
        {
          role: "user",
          content: prompt
        }
      ],
      stream: true
    });

    const final = await run.final;

    const plan = final?.contentText ?? "";

    res.json({
      plan
    });

  } catch (error) {
    console.error("QVAC error:", error);

    res.status(500).json({
      error: error.message || "QVAC inference failed."
    });
  }
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");

  if (modelId) {
    try {
      await unloadModel({ modelId });
    } catch (error) {
      console.error("Error unloading model:", error);
    }
  }

  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Exam Panic running at http://localhost:${PORT}`);
  console.log("Inference runs locally using QVAC.");
});