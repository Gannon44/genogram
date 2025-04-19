import { Person, Relationship } from './model.js';

// Load a sample JSON file into the genogram
export function loadSample(genogram) {
  fetch('examples/sample.json')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load sample.json');
      return res.json();
    })
    .then(data => {
      // Reset genogram state
      genogram.people = {};
      genogram.rels = {};
      genogram.nextId = 1;

      // Rehydrate people
      for (const [id, raw] of Object.entries(data.people)) {
        const p = Object.assign(new Person(id), raw);
        genogram.people[id] = p;
        const num = parseInt(id.slice(1), 10);
        if (num >= genogram.nextId) genogram.nextId = num + 1;
      }
      // Rehydrate relationships
      for (const [id, raw] of Object.entries(data.rels)) {
        const r = Object.assign(new Relationship(id, raw.type, raw.a, raw.b), raw);
        genogram.rels[id] = r;
        const num = parseInt(id.slice(1), 10);
        if (num >= genogram.nextId) genogram.nextId = num + 1;
      }
    })
    .catch(err => console.error(err));
}

// Convert mouse event to SVG coordinates
export function getMousePosition(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: svgP.x, y: svgP.y };
}

// Hit‑test a click against all people (circular radius)
export function hitTestPerson(genogram, x, y) {
  const radius = 30;
  for (const person of Object.values(genogram.people)) {
    const dx = x - person.position.x;
    const dy = y - person.position.y;
    if (dx * dx + dy * dy <= radius * radius) {
      return person.id;
    }
  }
  return null;
}

// Distance from point to segment helper
function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let t = dot / len_sq;
  t = Math.max(0, Math.min(1, t));
  const projx = x1 + t * C;
  const projy = y1 + t * D;
  const dx = px - projx;
  const dy = py - projy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Hit‑test a click against relationship lines
export function hitTestRel(genogram, x, y) {
  const threshold = 5;
  for (const rel of Object.values(genogram.rels)) {
    const pa = genogram.people[rel.a].position;
    const pb = genogram.people[rel.b].position;
    if (pointToSegmentDist(x, y, pa.x, pa.y, pb.x, pb.y) < threshold) {
      return rel.id;
    }
  }
  return null;
}

// Export current genogram to JSON and trigger download
export function exportJSON(genogram) {
  const dataStr = genogram.toJSON();
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'genogram.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Prompt user to choose a JSON file, then load into genogram
export function importJSON(genogram, onLoad) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.style.display = 'none';
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        genogram.fromJSON(ev.target.result);
        if (typeof onLoad === 'function') onLoad();
      } catch (err) {
        console.error('Invalid JSON file', err);
      }
    };
    reader.readAsText(file);
  });
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}