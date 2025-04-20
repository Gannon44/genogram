import { RELATIONSHIP_TYPES } from "./model.js";

/**
 * Map each relationship code to an SVG stroke‑dasharray.
 * (Slash overlays & twin triangles remain TODO)
 */
// map relationship codes → line dash & slash/backslash overlays
const REL_COUPLE_STYLE = {
  married: { dash: "", overlays: [] },
  legal_separation: { dash: "", overlays: ["/"] },
  divorced: { dash: "", overlays: ["/", "/"] },
  divorced_remarried: { dash: "", overlays: ["/", "X"] },
  separation_in_fact: { dash: "", overlays: ["\\"] },
  engagement: { dash: "8,4", overlays: [] },
  short_term: { dash: "2,4", overlays: [] },
  temporary: { dash: "8,4,2,4", overlays: [] },
  other_unknown: { dash: "2,4,2,10", overlays: [] },
};
const REL_CHILD_STYLE = {
  biological_child: { dash: "", overlays: [] },
  foster_child: { dash: "2,4", overlays: [] },
  adopted_child: { dash: "4,2,4,2", overlays: [] },
  fraternal_twins: { dash: "", overlays: [] },
  identical_twins: { dash: "", overlays: [] },
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
  // draw relationships
  gen.getRelationships().forEach(rel => {
    const [idA, idB] = rel.people;
    const pA = gen.people.get(idA);
    const pB = gen.people.get(idB);
    if (!pA || !pB) return;
    const style = REL_COUPLE_STYLE[rel.type] || { dash: "", overlays: [] };
    const dash = style.dash;

    // endpoints sorted left→right
    let x1 = pA.position.x, y1 = pA.position.y;
    let x2 = pB.position.x, y2 = pB.position.y;
    if (x1 > x2) { [x1, x2] = [x2, x1];[y1, y2] = [y2, y1]; }

    const group = document.createElementNS(svg.namespaceURI, "g");
    group.setAttribute("class", "relationship-group");
    group.dataset.id = rel.id;

    const drop = rel.meta.drop;
    // vertical stems
    [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach(pt => {
      const v = document.createElementNS(svg.namespaceURI, "line");
      v.setAttribute("x1", pt.x);
      v.setAttribute("y1", pt.y);
      v.setAttribute("x2", pt.x);
      v.setAttribute("y2", pt.y + drop);
      v.setAttribute("class", "relationship");
      v.setAttribute("stroke-dasharray", dash);
      group.appendChild(v);
    });
    // horizontal connector
    const h = document.createElementNS(svg.namespaceURI, "line");
    h.setAttribute("x1", x1);
    h.setAttribute("y1", y1 + drop);
    h.setAttribute("x2", x2);
    h.setAttribute("y2", y1 + drop);
    h.setAttribute("class", "relationship");
    h.setAttribute("stroke-dasharray", dash);
    group.appendChild(h);
    // overlay slashes/backslashes
    const cx = (x1 + x2) / 2, cy = y1 + drop, size = 12;
    style.overlays.forEach((ch, i) => {
      const dx = (i - (style.overlays.length) / 2) * 8;
      const path = document.createElementNS(svg.namespaceURI, "path");
      if (ch == "\\") {
        path.setAttribute("d", `M ${cx + dx - size / 2} ${cy - size / 2} L ${cx + dx + size / 2} ${cy + size / 2}`);
      } else if (ch == "/") {
        path.setAttribute("d", `M ${cx + dx - size / 2} ${cy + size / 2} L ${cx + dx + size / 2} ${cy - size / 2}`);
      } else {
        // Create two paths for all other cases and concatenate them
        const path1 = `M ${cx + dx - size / 2} ${cy - size / 2} L ${cx + dx + size / 2} ${cy + size / 2}`; // Top-left to bottom-right
        const path2 = `M ${cx + dx + size / 2} ${cy - size / 2} L ${cx + dx - size / 2} ${cy + size / 2}`; // Top-right to bottom-left
        path.setAttribute("d", path1 + ' ' + path2); // Concatenate both paths
      }

      path.setAttribute("stroke", "#888");
      path.setAttribute("stroke-width", "2");
      group.appendChild(path);
    });
    svg.appendChild(group);
  });

  // 5) Draw people on top
  gen.getPeople().forEach(p => {
    const { x, y } = p.position;
    let node;
    if (p.gender === "male") {
      node = document.createElementNS(svg.namespaceURI, "rect");
      const s = 40;
      node.setAttribute("x", x - s / 2);
      node.setAttribute("y", y - s / 2);
      node.setAttribute("width", s);
      node.setAttribute("height", s);
    } else if (p.gender === "female") {
      node = document.createElementNS(svg.namespaceURI, "circle");
      node.setAttribute("cx", x);
      node.setAttribute("cy", y);
      node.setAttribute("r", 20);
    } else {
      node = document.createElementNS(svg.namespaceURI, "polygon");
      node.setAttribute("points", `${x - 20},${y} ${x},${y - 20} ${x + 20},${y} ${x},${y + 20}`);
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