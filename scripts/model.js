// Simple unique‐ID generator
function generateId(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Represents an individual in the genogram.
   */
  export class Person {
    /**
     * @param {object} opts
     * @param {string} opts.id                 – leave blank to auto‐generate
     * @param {string} opts.firstName
     * @param {string} opts.middleName
     * @param {string} opts.lastName
     * @param {string} opts.hyphenatedLastName
     * @param {string[]} opts.formerLastNames
     * @param {{day:number,month:number,year:number}|null} opts.birthDate
     * @param {boolean} opts.alive
     * @param {{day:number,month:number,year:number}|null} opts.deathDate
     * @param {string} opts.gender             – e.g. "male", "female", "non_binary"
     * @param {string} opts.sexualOrientation  – default "straight"
     * @param {string} opts.notes
     * @param {{x:number,y:number}} opts.position – canvas coords
     */
    constructor({
      id = generateId("p"),
      firstName = "",
      middleName = "",
      lastName = "",
      hyphenatedLastName = "",
      formerLastNames = [],
      birthDate = null,
      alive = true,
      deathDate = null,
      gender = "female",
      sexualOrientation = "straight",
      notes = "",
      position = { x: 0, y: 0 },
    } = {}) {
      this.id = id;
      this.firstName = firstName;
      this.middleName = middleName;
      this.lastName = lastName;
      this.hyphenatedLastName = hyphenatedLastName;
      this.formerLastNames = Array.isArray(formerLastNames)
        ? formerLastNames
        : [];
      this.birthDate = birthDate; // {day,month,year} or null
      this.alive = alive;
      this.deathDate = deathDate; // {day,month,year} or null
      this.gender = gender;
      this.sexualOrientation = sexualOrientation;
      this.notes = notes;
      this.position = { ...position };
    }
  }
  
  /**
   * All supported relationship types (for dropdowns & view logic).
   * Your UI can map `code` → `label`, and view.js can map `code` → line style.
   */
  export const RELATIONSHIP_TYPES = [
    // Couple / Marriage / Partnership
    { code: "married", label: "Married" },
    { code: "legal_separation", label: "Legal Separation" },
    { code: "divorced", label: "Divorced" },
    { code: "divorced_remarried", label: "Divorced then Remarried" },
    { code: "separation_in_fact", label: "Separation in Fact" },
    { code: "engagement", label: "Engagement / Long‑Term" },
    { code: "short_term", label: "Short‑Term Relationship" },
    { code: "temporary", label: "Temporary / One‑Night Stand" },
    { code: "other_unknown", label: "Other / Unknown" },
  
    // Parent‑child
    { code: "biological_child", label: "Biological Child" },
    { code: "foster_child", label: "Foster Child" },
    { code: "adopted_child", label: "Adopted Child" },
  
    // Twins (special sibling relationships)
    { code: "fraternal_twins", label: "Fraternal Twins" },
    { code: "identical_twins", label: "Identical Twins" },
  ];
  
  /**
   * Represents a relationship between two (or more) people.
   */
  export class Relationship {
    /**
     * @param {object} opts
     * @param {string} opts.id     – leave blank to auto‑generate
     * @param {string} opts.type   – one of RELATIONSHIP_TYPES.code
     * @param {string[]} opts.people – array of person IDs (2 for couple or parent-child; 2 for twin pair)
     * @param {object} opts.meta   – optional extra metadata
     */
    constructor({ id = generateId("r"), type, people = [], meta = {} } = {}) {
      this.id = id;
      this.type = type;
      this.people = Array.isArray(people) ? people : [];
      this.meta = meta;
    }
  }
  
  /**
   * Manages the collection of people & relationships in the genogram.
   */
  export class Genogram {
    constructor() {
      /** @type {Map<string, Person>} */
      this.people = new Map();
      /** @type {Map<string, Relationship>} */
      this.relationships = new Map();
    }
  
    /** @param {Person} person */
    addPerson(person) {
      this.people.set(person.id, person);
    }
  
    /** @param {string} personId */
    removePerson(personId) {
      this.people.delete(personId);
      // also drop any relationships that mention this person
      for (const [rid, rel] of this.relationships) {
        if (rel.people.includes(personId)) {
          this.relationships.delete(rid);
        }
      }
    }
  
    /** @param {Relationship} rel */
    addRelationship(rel) {
      this.relationships.set(rel.id, rel);
    }
  
    /** @param {string} relId */
    removeRelationship(relId) {
      this.relationships.delete(relId);
    }
  
    /** @returns {Person[]} */
    getPeople() {
      return Array.from(this.people.values());
    }
  
    /** @returns {Relationship[]} */
    getRelationships() {
      return Array.from(this.relationships.values());
    }
  
    /**
     * @param {string} personId
     * @returns {Relationship[]}
     */
    findRelationshipsByPerson(personId) {
      return this.getRelationships().filter((r) =>
        r.people.includes(personId)
      );
    }
  
    /** Export to a JSON‑serializable object */
    toJSON() {
      return {
        people: this.getPeople().map((p) => ({
          id: p.id,
          firstName: p.firstName,
          middleName: p.middleName,
          lastName: p.lastName,
          hyphenatedLastName: p.hyphenatedLastName,
          formerLastNames: [...p.formerLastNames],
          birthDate: p.birthDate,
          alive: p.alive,
          deathDate: p.deathDate,
          gender: p.gender,
          sexualOrientation: p.sexualOrientation,
          notes: p.notes,
          position: { ...p.position },
        })),
        relationships: this.getRelationships().map((r) => ({
          id: r.id,
          type: r.type,
          people: [...r.people],
          meta: { ...r.meta },
        })),
      };
    }
  
    /**
     * Create a Genogram from a parsed JSON object.
     * @param {{people:object[], relationships:object[]}} data
     * @returns {Genogram}
     */
    static fromJSON(data) {
      const g = new Genogram();
      (data.people || []).forEach((pd) => {
        g.addPerson(new Person(pd));
      });
      (data.relationships || []).forEach((rd) => {
        g.addRelationship(new Relationship(rd));
      });
      return g;
    }
  }
  