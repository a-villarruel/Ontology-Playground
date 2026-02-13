/**
 * Zustand store for the Ontology Designer.
 *
 * Manages a *draft* ontology that is independent of the main appStore.
 * Changes here don't affect the main graph until the user explicitly
 * exports or loads the designed ontology.
 */
import { create } from 'zustand';
import type { Ontology, EntityType, Property, Relationship, RelationshipAttribute } from '../data/ontology';

// ─── Validation ──────────────────────────────────────────────────────────────

export interface ValidationError {
  message: string;
  entityId?: string;
  relationshipId?: string;
}

export function validateOntology(ontology: Ontology): ValidationError[] {
  const errors: ValidationError[] = [];

  if (ontology.entityTypes.length === 0) {
    errors.push({ message: 'Add at least one entity type to your ontology.' });
  }

  const entityIds = new Set<string>();
  const entityNameById = new Map<string, string>();
  for (const e of ontology.entityTypes) {
    const label = e.name || 'Unnamed entity';
    if (!e.id) {
      errors.push({ message: `"${label}" is missing an internal ID.`, entityId: e.id });
    } else if (entityIds.has(e.id)) {
      errors.push({ message: `Two entities share the same ID "${e.id}". Rename one of them.`, entityId: e.id });
    } else {
      entityIds.add(e.id);
      entityNameById.set(e.id, label);
    }
    if (!e.name) {
      errors.push({ message: 'One of your entities has no name. Give it a name.', entityId: e.id });
    }
    const hasIdentifier = e.properties.some((p) => p.isIdentifier);
    if (!hasIdentifier) {
      errors.push({
        message: `"${label}" has no identifier property. Click the key icon (🔑) on one of its properties to mark it as the unique identifier.`,
        entityId: e.id,
      });
    }
  }

  const relIds = new Set<string>();
  for (const r of ontology.relationships) {
    const label = r.name || 'Unnamed relationship';
    if (!r.id) {
      errors.push({ message: `"${label}" is missing an internal ID.`, relationshipId: r.id });
    } else if (relIds.has(r.id)) {
      errors.push({ message: `Two relationships share the same ID "${r.id}". Rename one of them.`, relationshipId: r.id });
    } else {
      relIds.add(r.id);
    }
    if (!entityIds.has(r.from)) {
      const fromLabel = r.from || '(none)';
      errors.push({
        message: `"${label}" points from "${fromLabel}" which doesn't exist. Pick a valid source entity.`,
        relationshipId: r.id,
      });
    }
    if (!entityIds.has(r.to)) {
      const toLabel = r.to || '(none)';
      errors.push({
        message: `"${label}" points to "${toLabel}" which doesn't exist. Pick a valid target entity.`,
        relationshipId: r.id,
      });
    }
  }

  return errors;
}

// ─── ID helpers ──────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'entity';
}

let entityCounter = 0;
let relationshipCounter = 0;

function nextEntityId(name: string): string {
  return `${slugify(name)}-${++entityCounter}`;
}

function nextRelationshipId(name: string): string {
  return `rel-${slugify(name)}-${++relationshipCounter}`;
}

// ─── Default palette ─────────────────────────────────────────────────────────

export const ENTITY_COLORS = [
  '#0078D4', '#107C10', '#D83B01', '#5C2D91',
  '#00A9E0', '#FFB900', '#E81123', '#008272',
];

export const ENTITY_ICONS = [
  '📦', '👤', '🏢', '📋', '🛒', '💳', '📊', '🔧',
  '🌐', '📁', '🎯', '⚡', '🔗', '📝', '🏷️', '📈',
];

// ─── Store ───────────────────────────────────────────────────────────────────

interface DesignerState {
  // Draft ontology
  ontology: Ontology;
  selectedEntityId: string | null;
  selectedRelationshipId: string | null;
  validationErrors: ValidationError[];

  // Actions — ontology metadata
  setOntologyName: (name: string) => void;
  setOntologyDescription: (description: string) => void;

  // Actions — entities
  addEntity: () => void;
  updateEntity: (id: string, updates: Partial<Omit<EntityType, 'id' | 'properties'>>) => void;
  removeEntity: (id: string) => void;
  selectEntity: (id: string | null) => void;

  // Actions — properties
  addProperty: (entityId: string) => void;
  updateProperty: (entityId: string, index: number, updates: Partial<Property>) => void;
  removeProperty: (entityId: string, index: number) => void;
  moveProperty: (entityId: string, fromIndex: number, toIndex: number) => void;

  // Actions — relationships
  addRelationship: (from: string, to: string) => void;
  updateRelationship: (id: string, updates: Partial<Omit<Relationship, 'id'>>) => void;
  removeRelationship: (id: string) => void;
  selectRelationship: (id: string | null) => void;
  addRelationshipAttribute: (relId: string) => void;
  updateRelationshipAttribute: (relId: string, index: number, updates: Partial<RelationshipAttribute>) => void;
  removeRelationshipAttribute: (relId: string, index: number) => void;

  // Actions — bulk
  loadDraft: (ontology: Ontology) => void;
  resetDraft: () => void;
  validate: () => ValidationError[];
}

function emptyOntology(): Ontology {
  return {
    name: 'My Ontology',
    description: '',
    entityTypes: [],
    relationships: [],
  };
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  ontology: emptyOntology(),
  selectedEntityId: null,
  selectedRelationshipId: null,
  validationErrors: [],

  // ─ Metadata ─────────────────────────────────────────────────────────────
  setOntologyName: (name) =>
    set((s) => ({ ontology: { ...s.ontology, name } })),

  setOntologyDescription: (description) =>
    set((s) => ({ ontology: { ...s.ontology, description } })),

  // ─ Entities ─────────────────────────────────────────────────────────────
  addEntity: () => {
    const name = 'New Entity';
    const colorIdx = get().ontology.entityTypes.length % ENTITY_COLORS.length;
    const iconIdx = get().ontology.entityTypes.length % ENTITY_ICONS.length;
    const entity: EntityType = {
      id: nextEntityId(name),
      name,
      description: '',
      icon: ENTITY_ICONS[iconIdx],
      color: ENTITY_COLORS[colorIdx],
      properties: [{ name: 'id', type: 'string', isIdentifier: true }],
    };
    set((s) => ({
      ontology: { ...s.ontology, entityTypes: [...s.ontology.entityTypes, entity] },
      selectedEntityId: entity.id,
      selectedRelationshipId: null,
    }));
  },

  updateEntity: (id, updates) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        entityTypes: s.ontology.entityTypes.map((e) =>
          e.id === id ? { ...e, ...updates } : e,
        ),
      },
    })),

  removeEntity: (id) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        entityTypes: s.ontology.entityTypes.filter((e) => e.id !== id),
        relationships: s.ontology.relationships.filter(
          (r) => r.from !== id && r.to !== id,
        ),
      },
      selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
    })),

  selectEntity: (id) =>
    set({ selectedEntityId: id, selectedRelationshipId: null }),

  // ─ Properties ───────────────────────────────────────────────────────────
  addProperty: (entityId) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        entityTypes: s.ontology.entityTypes.map((e) =>
          e.id === entityId
            ? { ...e, properties: [...e.properties, { name: '', type: 'string' as const }] }
            : e,
        ),
      },
    })),

  updateProperty: (entityId, index, updates) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        entityTypes: s.ontology.entityTypes.map((e) =>
          e.id === entityId
            ? {
                ...e,
                properties: e.properties.map((p, i) =>
                  i === index ? { ...p, ...updates } : p,
                ),
              }
            : e,
        ),
      },
    })),

  removeProperty: (entityId, index) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        entityTypes: s.ontology.entityTypes.map((e) =>
          e.id === entityId
            ? { ...e, properties: e.properties.filter((_, i) => i !== index) }
            : e,
        ),
      },
    })),

  moveProperty: (entityId, fromIndex, toIndex) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        entityTypes: s.ontology.entityTypes.map((e) => {
          if (e.id !== entityId) return e;
          const props = [...e.properties];
          const [moved] = props.splice(fromIndex, 1);
          props.splice(toIndex, 0, moved);
          return { ...e, properties: props };
        }),
      },
    })),

  // ─ Relationships ────────────────────────────────────────────────────────
  addRelationship: (from, to) => {
    const rel: Relationship = {
      id: nextRelationshipId('relates-to'),
      name: 'relates_to',
      from,
      to,
      cardinality: 'one-to-many',
      description: '',
    };
    set((s) => ({
      ontology: { ...s.ontology, relationships: [...s.ontology.relationships, rel] },
      selectedRelationshipId: rel.id,
      selectedEntityId: null,
    }));
  },

  updateRelationship: (id, updates) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        relationships: s.ontology.relationships.map((r) =>
          r.id === id ? { ...r, ...updates } : r,
        ),
      },
    })),

  removeRelationship: (id) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        relationships: s.ontology.relationships.filter((r) => r.id !== id),
      },
      selectedRelationshipId: s.selectedRelationshipId === id ? null : s.selectedRelationshipId,
    })),

  selectRelationship: (id) =>
    set({ selectedRelationshipId: id, selectedEntityId: null }),

  addRelationshipAttribute: (relId) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        relationships: s.ontology.relationships.map((r) =>
          r.id === relId
            ? { ...r, attributes: [...(r.attributes ?? []), { name: '', type: 'string' }] }
            : r,
        ),
      },
    })),

  updateRelationshipAttribute: (relId, index, updates) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        relationships: s.ontology.relationships.map((r) =>
          r.id === relId
            ? {
                ...r,
                attributes: (r.attributes ?? []).map((a, i) =>
                  i === index ? { ...a, ...updates } : a,
                ),
              }
            : r,
        ),
      },
    })),

  removeRelationshipAttribute: (relId, index) =>
    set((s) => ({
      ontology: {
        ...s.ontology,
        relationships: s.ontology.relationships.map((r) =>
          r.id === relId
            ? { ...r, attributes: (r.attributes ?? []).filter((_, i) => i !== index) }
            : r,
        ),
      },
    })),

  // ─ Bulk ─────────────────────────────────────────────────────────────────
  loadDraft: (ontology) =>
    set({ ontology, selectedEntityId: null, selectedRelationshipId: null, validationErrors: [] }),

  resetDraft: () =>
    set({ ontology: emptyOntology(), selectedEntityId: null, selectedRelationshipId: null, validationErrors: [] }),

  validate: () => {
    const errors = validateOntology(get().ontology);
    set({ validationErrors: errors });
    return errors;
  },
}));
