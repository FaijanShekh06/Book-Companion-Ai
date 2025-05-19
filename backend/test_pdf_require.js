async function testImport() {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    console.log("PDF.js imported successfully in test file:", pdfjs);
  } catch (error) {
    console.error("Error importing PDF.js in test file:", error);
  }
}

testImport();
