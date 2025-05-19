const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { VertexAI, GenerativeModel } = require("@google-cloud/vertexai"); // Ensure GenerativeModel is imported

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// --- PDF Text Extraction ---
let pdfjsLib;
let fetch;

async function loadFetch() {
  try {
    const nodeFetch = await import("node-fetch");
    fetch = nodeFetch.default;
    console.log("loadFetch completed successfully.");
  } catch (error) {
    console.error("Error loading node-fetch:", error);
  }
}

async function loadPdfjs() {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib = pdfjs;
    console.log("loadPdfjs completed successfully using import and .mjs.");
  } catch (error) {
    console.error(
      "Error loading PDF.js (legacy) using import and .mjs:",
      error
    );
  }
}

// Function to initialize and start the server after libraries are loaded
async function startServer() {
  await Promise.all([loadFetch(), loadPdfjs()]);

  // Initialize Vertex AI *after* the other libraries have loaded
  const vertexAI = new VertexAI({
    project: "ai-book-companion-457008", // Replace with your Project ID
    location: "us-central1", // Adjust location if needed
    apiKey: "AIzaSyAvl6UYv2PBPnP7Ko-1T2Xhob9UTYZXdL0", // Replace with your API Key
  });

  // Get the Gemini Pro model
  const model = new GenerativeModel({
    model: "gemini-pro",
    vertexAI,
  });

  app.post("/api/process-pdf", async (req, res) => {
    const { pdfUrl } = req.body;
    if (!pdfUrl) {
      return res.status(400).json({ error: "PDF URL is required." });
    }

    if (!pdfjsLib || !fetch) {
      return res.status(503).json({
        error:
          "Backend libraries are still loading. Please try again in a moment.",
      });
    }

    try {
      console.log(`Processing PDF from: ${pdfUrl}`);
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch PDF: ${response.status} ${response.statusText}`
        );
      }
      const buffer = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(buffer).promise;
      const numPages = pdf.numPages;
      let fullText = "";

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      res.json({ message: "PDF text extracted successfully!", text: fullText });
    } catch (error) {
      console.error("Error processing PDF:", error);
      res
        .status(500)
        .json({ error: `Failed to process PDF: ${error.message}` });
    }
  });

  // --- Gemini API Endpoints ---
  app.post("/api/summarize", async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text to summarize is required." });
    }
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: `Please summarize the following text:\n\n${text}` },
            ],
          },
        ],
      });
      const response = result.response;
      const summary = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (summary) {
        res.json({ summary });
      } else {
        res
          .status(500)
          .json({ error: "Failed to generate summary from Gemini." });
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      res
        .status(500)
        .json({ error: `Failed to generate summary: ${error.message}` });
    }
  });

  app.post("/api/ask", async (req, res) => {
    const { text, question } = req.body;
    if (!text || !question) {
      return res.status(400).json({ error: "Text and question are required." });
    }
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Based on the following text:\n\n${text}\n\nAnswer this question: ${question}`,
              },
            ],
          },
        ],
      });
      const response = result.response;
      const answer = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer) {
        res.json({ answer });
      } else {
        res.status(500).json({ error: "Failed to get answer from Gemini." });
      }
    } catch (error) {
      console.error("Error asking question:", error);
      res.status(500).json({ error: `Failed to get answer: ${error.message}` });
    }
  });

  app.post("/api/generate-quiz", async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res
        .status(400)
        .json({ error: "Text is required to generate a quiz." });
    }
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Generate 5 multiple-choice questions and answers based on the following text:\n\n${text}`,
              },
            ],
          },
        ],
      });
      const response = result.response;
      const quiz = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (quiz) {
        res.json({ quiz });
      } else {
        res.status(500).json({ error: "Failed to generate quiz from Gemini." });
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      res
        .status(500)
        .json({ error: `Failed to generate quiz: ${error.message}` });
    }
  });

  app.get("/api", (req, res) => {
    res.json({ message: "Backend is running with Gemini API integration!" });
  });

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

// Start the server
startServer();
