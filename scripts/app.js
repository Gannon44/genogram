// scripts/app.js
import { Genogram } from "./model.js";
import { render } from "./view.js";
import Controller from "./controller.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("🧩 Genogram App initializing...");

  // 1. Build the genogram data model
  const gen = new Genogram();
  window.gen = gen;              // for debugging in console

  // 2. Initial render (empty genogram or you could load a sample here)
  render(gen);

  // 3. Hook up your interaction logic
  const ctrl = new Controller(gen, render);
  window.ctrl = ctrl;            // for debugging

  // 4. Find toolbar elements
  const exportBtn = document.getElementById("export-json-btn");
  const importBtn = document.getElementById("import-json-btn");
  const fileInput = document.getElementById("import-file-input");

  if (!exportBtn || !importBtn || !fileInput) {
    console.error(
      "Import/Export UI elements not found:",
      { exportBtn, importBtn, fileInput }
    );
    return;
  }

  // 5. EXPORT handler
  exportBtn.addEventListener("click", () => {
    const data = gen.toJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "genogram.json";
    a.click();
    URL.revokeObjectURL(url);
    console.log("📤 Genogram exported.");
  });

  // 6. IMPORT handler
  importBtn.addEventListener("click", () => {
    fileInput.value = null;   // reset selection so same file can be re‑picked
    fileInput.click();
  });

  fileInput.addEventListener("change", (evt) => {
    const file = evt.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        const newGen = Genogram.fromJSON(obj);

        // Swap in the new data
        gen.people = newGen.people;
        gen.relationships = newGen.relationships;

        // Re‑render and reset selection state
        render(gen);
        if (typeof ctrl.resetSelection === "function") {
          ctrl.resetSelection();
        }

        console.log("📥 Genogram imported successfully.");
      } catch (err) {
        console.error("Failed to parse JSON:", err);
        alert("❌ Failed to load JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  });
});
