import { Person, Relationship, RELATIONSHIP_TYPES } from "./model.js";
import { render } from "./view.js";

export default class Controller {
  constructor(gen, renderFn) {
    this.gen = gen;
    this.render = renderFn;
    this.svg = document.getElementById("canvas");
    this.addMenu = document.getElementById("add-menu");
    this.detailsContainer = document.getElementById("form-fields");

    // grid/zoom state
    this.gridSize = 20;
    this.pendingAdd = null;

    // selection/drag state
    this.selectedPeople = new Set();
    this.selectedRel = null;
    this.dragging = false;
    this.dragTarget = null;
    this.dragOffset = {};
    this.panStart = {};
    this.viewBoxStart = {};

    // // marquee‐select state
    // this.isSelectingBox = false;
    // this.selStart       = null;
    // this.selectBoxEl    = document.createElementNS(this.svg.namespaceURI, "rect");
    // this.selectBoxEl.setAttribute("class", "select-rect");
    // this.selectBoxEl.setAttribute("stroke-dasharray", "4");
    // this.selectBoxEl.setAttribute("fill", "none");
    // this.svg.appendChild(this.selectBoxEl);
    // marquee‐select state (HTML overlay)
    this.isSelectingBox = false;
    this.boxStartClient = null;
    this.selStart = null;
    this.marquee = document.getElementById("marquee");

    // initialize viewBox
    const w = this.svg.clientWidth, h = this.svg.clientHeight;
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    this._addEventListeners();
    this.render(this.gen); // initial draw
  }

  _addEventListeners() {
    this.svg.addEventListener("mousedown", (evt) => this._onMouseDown(evt));
    window.addEventListener("mousemove", (evt) => this._onMouseMove(evt));
    window.addEventListener("mouseup", (evt) => this._onMouseUp(evt));
    this.svg.addEventListener("wheel", (evt) => this._onWheel(evt), { passive: false });

    // Add‑menu clicks
    this.addMenu.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const btn = evt.target.closest("button[data-gender]");
      if (!btn || !this.pendingAdd) return;
      const gender = btn.dataset.gender;
      const { x, y } = this.pendingAdd;
      const p = new Person({ position: { x, y }, gender });
      this.gen.addPerson(p);
      this._selectPerson(p.id, false);
      this.render(this.gen);
      this._renderDetails();
      this.addMenu.style.display = "none";
      this.pendingAdd = null;
    });

    window.addEventListener("keydown", (evt) => this._onKeyDown(evt));
    this.svg.addEventListener("dragstart", (evt) => evt.preventDefault());
  }

  _onMouseDown(evt) {
    const pt = this._getSVGPoint(evt);
    const personEl = evt.target.closest(".person");
    const relEl = evt.target.closest(".relationship-group");

    // hide add‑menu
    this.addMenu?.style && (this.addMenu.style.display = "none");
    this.pendingAdd = null;

    // CTRL+click blank → show add‑menu
    if (evt.ctrlKey && !personEl && !relEl) {
      const snapped = this._snapToGrid(pt.x, pt.y);
      this.pendingAdd = snapped;
      this.addMenu.style.left = `${evt.clientX}px`;
      this.addMenu.style.top = `${evt.clientY}px`;
      this.addMenu.style.display = "block";
      return;
    }

    // // SHIFT‑drag blank → start box‐select
    // if (evt.shiftKey && !personEl && !relEl && evt.button === 0) {
    //   this.isSelectingBox = true;
    //   this.selStart = { x: evt.clientX, y: evt.clientY, svgPt: pt };
    //   this.selectBoxEl.style.display = "block";
    //   this.selectBoxEl.setAttribute("x", pt.x);
    //   this.selectBoxEl.setAttribute("y", pt.y);
    //   this.selectBoxEl.setAttribute("width", 0);
    //   this.selectBoxEl.setAttribute("height", 0);
    //   return;
    // }

    if (evt.shiftKey && !personEl && !relEl && evt.button === 0) {
      // start marquee selection
      this.isSelectingBox = true;
      this.dragging = true;
      this.dragTarget = { type: 'marquee' };
      this.boxStartClient = { x: evt.clientX, y: evt.clientY };
      this.selStart = { svgPt: pt };
      this.marquee.style.display = "block";
      this.marquee.style.left = `${evt.clientX}px`;
      this.marquee.style.top = `${evt.clientY}px`;
      this.marquee.style.width = `0px`;
      this.marquee.style.height = `0px`;
      return;
    }


    // click person → select + details + start drag
    if (personEl) {
      const id = personEl.dataset.id;
      if (evt.shiftKey) this._togglePerson(id);
      else this._selectPerson(id, false);

      this.render(this.gen);
      this._updateHighlights();
      this._renderDetails();

      this.dragging = true;
      this.dragTarget = { type: "person", id };
      const p = this.gen.people.get(id);
      this.dragOffset = { x: pt.x - p.position.x, y: pt.y - p.position.y };
      return;
    }

    // click relationship → select
    if (relEl) {
      const id = relEl.dataset.id;
      this._selectRel(id);
      this.render(this.gen);
      this._renderDetails();
      return;
    }

    // blank click → clear + start pan
    this._clearSelection();
    this.render(this.gen);
    this._clearDetails();

    this.dragging = true;
    this.dragTarget = { type: "pan" };
    this.panStart = { x: evt.clientX, y: evt.clientY };
    const vb = this.svg.viewBox.baseVal;
    this.viewBoxStart = { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
    this.svg.classList.add("dragging");
  }

  _onMouseMove(evt) {
    if (!this.dragging) return;
    const pt = this._getSVGPoint(evt);

    // if no other drag target, bail early
    if (!this.dragTarget) return;

    // update HTML marquee overlay
    if (this.dragTarget?.type === 'marquee') {
      const dx = evt.clientX - this.boxStartClient.x;
      const dy = evt.clientY - this.boxStartClient.y;
      const left = dx >= 0 ? this.boxStartClient.x : evt.clientX;
      const top = dy >= 0 ? this.boxStartClient.y : evt.clientY;
      this.marquee.style.left = `${left}px`;
      this.marquee.style.top = `${top}px`;
      this.marquee.style.width = `${Math.abs(dx)}px`;
      this.marquee.style.height = `${Math.abs(dy)}px`;
      return;
    }

    if (this.dragTarget.type === "person") {
      const p = this.gen.people.get(this.dragTarget.id);
      const rawX = pt.x - this.dragOffset.x;
      const rawY = pt.y - this.dragOffset.y;
      p.position = this._snapToGrid(rawX, rawY);
      this.render(this.gen);
      this._updateHighlights();
      this._renderDetails();
    } else if (this.dragTarget.type === "pan") {
      const dx = evt.clientX - this.panStart.x;
      const dy = evt.clientY - this.panStart.y;
      const vb = this.svg.viewBox.baseVal;
      const { x: x0, y: y0, width: w0, height: h0 } = this.viewBoxStart;
      vb.x = x0 - dx * (w0 / this.svg.clientWidth);
      vb.y = y0 - dy * (h0 / this.svg.clientHeight);
      // redraw grid + shapes
      this.render(this.gen);
      this._updateHighlights();
    }
  }

  _onMouseUp(evt) {
    // // finish marquee‐select
    // if (this.isSelectingBox) {
    //   this.isSelectingBox = false;
    //   this.selectBoxEl.style.display = "none";
    //   const box = this.selectBoxEl.getBBox();
    //   // clear prev selections
    //   this._clearSelection();
    //   // select people inside
    //   for (const [id,p] of this.gen.people) {
    //     if (p.position.x >= box.x && p.position.x <= box.x+box.width &&
    //         p.position.y >= box.y && p.position.y <= box.y+box.height) {
    //       this.selectedPeople.add(id);
    //     }
    //   }
    //   // select any relationship whose endpoints are both inside
    //   for (const [rid,rel] of this.gen.relationships) {
    //     const [a,b] = rel.people.map(pid => this.gen.people.get(pid).position);
    //     if (a.x >= box.x && a.x <= box.x+box.width &&
    //         a.y >= box.y && a.y <= box.y+box.height &&
    //         b.x >= box.x && b.x <= box.x+box.width &&
    //         b.y >= box.y && b.y <= box.y+box.height) {
    //       this.selectedRel = rid;
    //     }
    //   }
    //   this.render(this.gen);
    //   this._updateHighlights();
    //   this._renderDetails();
    //   return;
    // }



    // finish HTML marquee select
    if (this.dragTarget?.type === 'marquee') {
      this.isSelectingBox = false;
      this.marquee.style.display = "none";

      const endPt = this._getSVGPoint(evt);
      const x0 = this.selStart.svgPt.x, y0 = this.selStart.svgPt.y;
      const x1 = endPt.x, y1 = endPt.y;
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);

      this._clearSelection();
      // select persons whose center falls inside marquee
      for (const [id, p] of this.gen.people) {
        const { x, y } = p.position;
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          this.selectedPeople.add(id);
        }
      }
      // select relationships whose endpoints fall inside marquee

      // re-render and update details
      this.render(this.gen);
      this._updateHighlights();
      this._renderDetails();
      this.dragging = false;
      this.dragTarget = null;
      this.svg.classList.remove("dragging");
      return;
    }
    this.dragging = false;
    this.dragTarget = null;
    this.svg.classList.remove("dragging");
  }

  _onKeyDown(evt) {
    if (evt.key.toLowerCase() === "l" &&
      this.selectedPeople.size === 2 &&
      !this.selectedRel
    ) {
      const [a, b] = Array.from(this.selectedPeople);
      const rel = new Relationship({ type: "married", people: [a, b] });
      this.gen.addRelationship(rel);
      this.render(this.gen);
      this._updateHighlights();
    }
  }

  _onWheel(evt) {
    evt.preventDefault();
    const vb = this.svg.viewBox.baseVal;
    // current dims
    const x0 = vb.x, y0 = vb.y;
    const w0 = vb.width, h0 = vb.height;
    // pointer in user coords
    const pt = this._getSVGPoint(evt);
    // zoom factor
    const factor = evt.deltaY < 0 ? 0.9 : 1.1;
    const newW = w0 * factor;
    const newH = h0 * factor;

    // keep mouse position fixed
    vb.x = pt.x - (pt.x - x0) * (newW / w0);
    vb.y = pt.y - (pt.y - y0) * (newH / h0);
    vb.width = newW;
    vb.height = newH;

    // redraw
    this.render(this.gen);
    this._updateHighlights();
  }

  _snapToGrid(x, y) {
    const s = this.gridSize;
    return { x: Math.round(x / s) * s, y: Math.round(y / s) * s };
  }

  // ——— SELECTION HELPERS ———

  _selectPerson(id, append = true) {
    if (!append) this._clearSelection();
    // clear any highlighted relationship
    this.selectedRel = null;
    this.selectedPeople.add(id);
    this._updateHighlights();
  }

  _togglePerson(id) {
    if (this.selectedPeople.has(id)) this.selectedPeople.delete(id);
    else this.selectedPeople.add(id);
    this._updateHighlights();
  }

  _selectRel(id) {
    this._clearSelection();
    this.selectedRel = id;
    this._updateHighlights();
  }

  _clearSelection() {
    this.selectedPeople.clear();
    this.selectedRel = null;
    this._updateHighlights();
  }

  _updateHighlights() {
    // Clear all
    this.svg.querySelectorAll(".person.selected").forEach((el) =>
      el.classList.remove("selected")
    );
    this.svg
      .querySelectorAll(".relationship-group.selected")
      .forEach((el) => el.classList.remove("selected"));

    // Highlight people
    this.selectedPeople.forEach((id) => {
      const el = this.svg.querySelector(`.person[data-id="${id}"]`);
      el?.classList.add("selected");
    });

    // Highlight relationship
    if (this.selectedRel) {
      const relEl = this.svg.querySelector(
        `.relationship-group[data-id="${this.selectedRel}"]`
      );
      relEl?.classList.add("selected");
    }
  }

  // ——— DETAILS PANEL ———

  _renderDetails() {
    const container = this.detailsContainer;
    container.innerHTML = "";

    // multi‐person: show couple dropdown
    if (this.selectedPeople.size === 2 && !this.selectedRel) {
      const [id1, id2] = Array.from(this.selectedPeople);
      return this._renderPairForm(id1, id2);
    }
    // single person + single rel (parent/child) → parent/child form
    if (this.selectedPeople.size === 1 && this.selectedRel) {
      const pid = Array.from(this.selectedPeople)[0];
      const rel = this.gen.relationships.get(this.selectedRel);
      if (["biological_child", "foster_child", "adopted_child"].includes(rel.type)) {
        return this._renderParentChildForm(rel, pid);
      }
    }

    // If one person selected
    if (this.selectedPeople.size === 1 && !this.selectedRel) {
      const pid = Array.from(this.selectedPeople)[0];
      const p = this.gen.people.get(pid);
      this._renderPersonForm(p);
      return;
    }

    // If one relationship selected
    if (this.selectedRel && this.selectedPeople.size === 0) {
      const rel = this.gen.relationships.get(this.selectedRel);
      this._renderRelationshipForm(rel);
      return;
    }

    // Otherwise, generic message
    container.innerHTML = "<p>Select a single person or relationship</p>";
  }

  _clearDetails() {
    this.detailsContainer.innerHTML =
      "<p>Select a person or relationship</p>";
  }

  // Updated _renderPersonForm to include full details per spec
  _renderPersonForm(p) {
    const c = this.detailsContainer;
    c.innerHTML = "";

    // Helper to wrap label + field
    const mkField = (labelText, inputEl) => {
      const wrapper = document.createElement("div");
      wrapper.style.marginBottom = "0.75rem";
      const lab = document.createElement("label");
      lab.textContent = labelText;
      lab.style.fontWeight = "bold";
      wrapper.appendChild(lab);
      wrapper.appendChild(inputEl);
      return wrapper;
    };

    // First Name
    const first = document.createElement("input");
    first.type = "text";
    first.value = p.firstName;
    first.addEventListener("input", evt => { p.firstName = evt.target.value; this.render(this.gen); });
    c.appendChild(mkField("First Name", first));

    // Middle Name
    const middle = document.createElement("input");
    middle.type = "text";
    middle.value = p.middleName;
    middle.addEventListener("input", evt => { p.middleName = evt.target.value; this.render(this.gen); });
    c.appendChild(mkField("Middle Name", middle));

    // Last Name
    const last = document.createElement("input");
    last.type = "text";
    last.value = p.lastName;
    last.addEventListener("input", evt => { p.lastName = evt.target.value; this.render(this.gen); });
    c.appendChild(mkField("Last Name", last));

    // Hyphenated Last Name
    const hyphen = document.createElement("input");
    hyphen.type = "text";
    hyphen.value = p.hyphenatedLastName;
    hyphen.addEventListener("input", evt => { p.hyphenatedLastName = evt.target.value; this.render(this.gen); });
    c.appendChild(mkField("Hyphenated Last Name", hyphen));

    // Former Last Names
    const formerWrapper = document.createElement("div");
    const formerLab = document.createElement("label"); formerLab.textContent = "Former Last Names";
    formerLab.style.fontWeight = "bold";
    formerWrapper.appendChild(formerLab);
    const namesContainer = document.createElement("div");
    p.formerLastNames.forEach((name, idx) => {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = name;
      inp.style.marginTop = "0.25rem";
      inp.addEventListener("input", evt => { p.formerLastNames[idx] = evt.target.value; });
      namesContainer.appendChild(inp);
    });
    const addBtn = document.createElement("button");
    addBtn.textContent = "+ Add Name";
    addBtn.type = "button";
    addBtn.style.marginTop = "0.5rem";
    addBtn.addEventListener("click", () => {
      p.formerLastNames.push("");
      this._renderDetails();
    });
    formerWrapper.appendChild(namesContainer);
    formerWrapper.appendChild(addBtn);
    c.appendChild(formerWrapper);

    // Birthdate (D/M/Y)
    const bdFields = ["day", "month", "year"].map(key => {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.placeholder = key;
      inp.style.width = "30%";
      inp.style.marginRight = "3%";
      if (p.birthDate && p.birthDate[key]) inp.value = p.birthDate[key];
      inp.addEventListener("input", () => {
        const d = parseInt(bdFields[0].value), m = parseInt(bdFields[1].value), y = parseInt(bdFields[2].value);
        p.birthDate = (d && m && y) ? { day: d, month: m, year: y } : null;
        this.render(this.gen);
        this._renderDetails();
      });
      return inp;
    });
    const bdDiv = document.createElement("div"); bdFields.forEach(i => bdDiv.appendChild(i));
    c.appendChild(mkField("Birthdate (D/M/Y)", bdDiv));

    // Alive Toggle & Death Date
    const aliveLabel = document.createElement("label");
    aliveLabel.style.display = "block";
    const aliveInp = document.createElement("input");
    aliveInp.type = "checkbox";
    aliveInp.checked = p.alive;
    aliveInp.addEventListener("change", evt => { p.alive = evt.target.checked; this.render(this.gen); this._renderDetails(); });
    aliveLabel.append(" Alive? ", aliveInp);
    c.appendChild(aliveLabel);

    const death = document.createElement("input");
    death.type = "text";
    death.placeholder = "DD/MM/YYYY";
    death.disabled = p.alive;
    if (p.deathDate) death.value = `${p.deathDate.day}/${p.deathDate.month}/${p.deathDate.year}`;
    death.addEventListener("input", evt => {
      const [dd, mm, yy] = evt.target.value.split("/").map(n => parseInt(n));
      p.deathDate = (dd && mm && yy) ? { day: dd, month: mm, year: yy } : null;
      this.render(this.gen);
    });
    c.appendChild(mkField("Death Date", death));

    // Age (auto-calculated)
    const ageDiv = document.createElement("div");
    ageDiv.style.margin = "0.5rem 0";
    const ageLabel = document.createElement("strong");
    ageLabel.textContent = "Age: ";
    const ageVal = document.createElement("span");
    if (p.birthDate) {
      const today = new Date();
      let age = today.getFullYear() - p.birthDate.year;
      const mDiff = today.getMonth() + 1 - p.birthDate.month;
      const dDiff = today.getDate() - p.birthDate.day;
      if (mDiff < 0 || (mDiff === 0 && dDiff < 0)) age--;
      ageVal.textContent = age;
    } else ageVal.textContent = "—";
    ageDiv.append(ageLabel, ageVal);
    c.appendChild(ageDiv);

    // Gender
    const genderSel = document.createElement("select");
    ["male", "female", "non_binary", "other"].forEach(opt => {
      const o = document.createElement("option"); o.value = opt; o.textContent = opt.replace("_", " ");
      if (p.gender === opt) o.selected = true;
      genderSel.appendChild(o);
    });
    genderSel.addEventListener("change", evt => { p.gender = evt.target.value; this.render(this.gen); });
    c.appendChild(mkField("Gender", genderSel));

    // Sexual Orientation
    const orientSel = document.createElement("select");
    ["straight", "gay", "lesbian", "bisexual", "other"].forEach(opt => {
      const o = document.createElement("option"); o.value = opt; o.textContent = opt;
      if (p.sexualOrientation === opt) o.selected = true;
      orientSel.appendChild(o);
    });
    orientSel.addEventListener("change", evt => { p.sexualOrientation = evt.target.value; this.render(this.gen); });
    c.appendChild(mkField("Sexual Orientation", orientSel));

    // Notes
    const notes = document.createElement("textarea");
    notes.rows = 4;
    notes.value = p.notes;
    notes.addEventListener("input", evt => { p.notes = evt.target.value; });
    c.appendChild(mkField("Notes", notes));
  }

  // — Helpers for the new multi‐select forms —
  _renderPairForm(id1, id2) {
    const c = this.detailsContainer;
    c.innerHTML = "";
    // find existing couple
    const existing = Array.from(this.gen.relationships.values())
      .find(r => new Set(r.people).has(id1) && new Set(r.people).has(id2)
        && ["married", "legal_separation", "divorced", "divorced_remarried",
          "separation_in_fact", "engagement", "short_term", "temporary", "other_unknown"]
          .includes(r.type));
    const sel = document.createElement("select");
    // none
    sel.appendChild(Object.assign(document.createElement("option"), {
      value: "none", textContent: "No Relationship"
    }));
    // only couple types
    RELATIONSHIP_TYPES.filter(o =>
      ["married", "legal_separation", "divorced", "divorced_remarried",
        "separation_in_fact", "engagement", "short_term", "temporary", "other_unknown"]
        .includes(o.code)
    ).forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.code; opt.textContent = o.label;
      if (existing && existing.type === o.code) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", evt => {
      const code = evt.target.value;
      if (existing) {
        code === "none" ? this.gen.removeRelationship(existing.id)
          : existing.type = code;
      } else if (code !== "none") {
        this.gen.addRelationship(new Relationship({
          type: code, people: [id1, id2]
        }));
      }
      this.render(this.gen);
      this._updateHighlights();
    });
    c.appendChild(Object.assign(document.createElement("label"), {
      textContent: "Couple Relationship"
    }));
    c.appendChild(sel);
  }

  _renderParentChildForm(rel, childId) {
    const c = this.detailsContainer;
    c.innerHTML = "";
    // find other person as parent
    const parentId = rel.people.find(pid => pid !== childId);
    const parent = this.gen.people.get(parentId);
    const sel = document.createElement("select");
    ["biological_child", "foster_child", "adopted_child"].forEach(code => {
      const o = document.createElement("option");
      o.value = code;
      o.textContent = RELATIONSHIP_TYPES.find(rt => rt.code === code).label;
      if (rel.type === code) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", evt => {
      rel.type = evt.target.value;
      this.render(this.gen);
      this._updateHighlights();
    });
    c.appendChild(Object.assign(document.createElement("label"), {
      textContent: `Parent–Child (${parent.firstName} → Child)`
    }));
    c.appendChild(sel);
  }

  _renderRelationshipForm(rel) {
    const c = this.detailsContainer;
    c.innerHTML = "";

    // Type dropdown
    const sel = document.createElement("select");
    RELATIONSHIP_TYPES.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.code;
      o.textContent = opt.label;
      if (opt.code === rel.type) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", (evt) => {
      rel.type = evt.target.value;
      this.render(this.gen);
    });

    const wrapper = document.createElement("div");
    const lab = document.createElement("label");
    lab.textContent = "Relationship Type";
    wrapper.appendChild(lab);
    wrapper.appendChild(sel);
    c.appendChild(wrapper);
  }

  // ——— UTILITIES ———

  /** Convert screen event → SVG coordinates */
  _getSVGPoint(evt) {
    const pt = this.svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  resetSelection() {
    this._clearSelection();
    this._clearDetails();
    this.render(this.gen);
  }
}
