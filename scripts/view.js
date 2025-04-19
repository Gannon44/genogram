import { RELATIONSHIP_TYPES } from "./model.js";

/**
 * Map each relationship code to an SVG stroke‑dasharray.
 * (Slash overlays & twin triangles remain TODO)
 */
const REL_STYLE = {
  married: "",
  legal_separation: "",
  divorced: "",
  divorced_remarried: "",
  separation_in_fact: "",
  engagement: "8,4",
  short_term: "2,4",
  temporary: "8,4,2,4",
  other_unknown: "2,4,2,10",
  biological_child: "",
  foster_child: "2,4",
  adopted_child: "4,2,4,2",
  fraternal_twins: "",
  identical_twins: "",
};

export function render(gen) {
    const svg = document.getElementById("canvas");
  
    // 1) Clear all
    while (svg.lastChild) svg.removeChild(svg.lastChild);
  
    // 2) Build defs + 20×20 grid pattern
    const strokeColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--border-color").trim();
    const defs = document.createElementNS(svg.namespaceURI, "defs");
    const pattern = document.createElementNS(svg.namespaceURI, "pattern");
    pattern.setAttribute("id", "grid");
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("width", "20");
    pattern.setAttribute("height", "20");
  
    const vLine = document.createElementNS(svg.namespaceURI, "path");
    vLine.setAttribute("d", "M1 0 L1 20");
    vLine.setAttribute("stroke", strokeColor);
    vLine.setAttribute("stroke-width", "1");
    pattern.appendChild(vLine);
  
    const hLine = document.createElementNS(svg.namespaceURI, "path");
    hLine.setAttribute("d", "M0 1 L20 1");
    hLine.setAttribute("stroke", strokeColor);
    hLine.setAttribute("stroke-width", "1");
    pattern.appendChild(hLine);
  
    defs.appendChild(pattern);
    svg.appendChild(defs);
  
    // 3) Draw background rect covering the viewBox
    const vb = svg.viewBox.baseVal;
    const bg = document.createElementNS(svg.namespaceURI, "rect");
    bg.setAttribute("x", vb.x);
    bg.setAttribute("y", vb.y);
    bg.setAttribute("width", vb.width);
    bg.setAttribute("height", vb.height);
    bg.setAttribute("fill", "url(#grid)");
    bg.setAttribute("pointer-events", "none");
    svg.appendChild(bg);
  
    // 4) Draw relationships (couple, parent‑child, twins…)
    gen.getRelationships().forEach(rel => {
      // existing relationship‐drawing logic here…
    });
  
    // 5) Draw people on top
    gen.getPeople().forEach(p => {
      const { x,y } = p.position;
      let node;
      if (p.gender === "male") {
        node = document.createElementNS(svg.namespaceURI, "rect");
        const s = 40;
        node.setAttribute("x", x - s/2);
        node.setAttribute("y", y - s/2);
        node.setAttribute("width", s);
        node.setAttribute("height", s);
      } else {
        node = document.createElementNS(svg.namespaceURI, "circle");
        node.setAttribute("cx", x);
        node.setAttribute("cy", y);
        node.setAttribute("r", 20);
      }
      node.setAttribute("class", "person");
      node.setAttribute("data-id", p.id);
      svg.appendChild(node);
  
      // LGBTQ overlay (triangle)
      if (p.sexualOrientation && p.sexualOrientation !== "straight") {
        const tri = document.createElementNS(svg.namespaceURI, "path");
        const size = 20;
        const d = `
          M ${x} ${y + size / 2}
          L ${x + size / 2} ${y - size / 2}
          L ${x - size / 2} ${y - size / 2}
          Z
        `;
        tri.setAttribute("d", d);
        tri.setAttribute("fill", "#888");
        svg.appendChild(tri);
      }
    });
  }