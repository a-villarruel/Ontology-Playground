import { useState } from 'react';
import { Download, AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import { useDesignerStore } from '../../store/designerStore';
import type { ValidationError } from '../../store/designerStore';
import { useAppStore } from '../../store/appStore';
import { serializeToRDF } from '../../lib/rdf/serializer';
import { navigate } from '../../lib/router';

export function DesignerActions() {
  const { ontology, validationErrors, validate, resetDraft } = useDesignerStore();
  const loadOntology = useAppStore((s) => s.loadOntology);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const handleValidate = () => {
    const errors = validate();
    if (errors.length === 0) {
      setExportMessage('Ontology is valid!');
    } else {
      setExportMessage(null);
    }
  };

  const handleExportRDF = () => {
    const errors = validate();
    if (errors.length > 0) {
      setExportMessage(null);
      return;
    }
    try {
      const rdf = serializeToRDF(ontology, []);
      const blob = new Blob([rdf], { type: 'application/rdf+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ontology.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'ontology'}.rdf`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMessage('RDF file downloaded!');
    } catch (e) {
      setExportMessage(`Export failed: ${(e as Error).message}`);
    }
  };

  const handleLoadInPlayground = () => {
    const errors = validate();
    if (errors.length > 0) return;
    loadOntology(ontology, []);
    navigate({ page: 'home' });
  };

  const handleNewOntology = () => {
    resetDraft();
    setExportMessage(null);
  };

  return (
    <div className="designer-actions">
      <div className="designer-actions-row">
        <button className="designer-action-btn secondary" onClick={handleNewOntology}>
          New
        </button>
        <button className="designer-action-btn secondary" onClick={handleValidate}>
          Validate
        </button>
        <button className="designer-action-btn primary" onClick={handleExportRDF}>
          <Download size={14} /> Export RDF
        </button>
        <button className="designer-action-btn primary" onClick={handleLoadInPlayground}>
          <Upload size={14} /> Load in Playground
        </button>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="designer-validation-errors">
          <div className="designer-validation-header">
            <AlertTriangle size={14} /> {validationErrors.length} issue{validationErrors.length > 1 ? 's' : ''} to fix
          </div>
          <ul>
            {validationErrors.map((err, i) => (
              <li key={i}>
                <ErrorItem error={err} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success message */}
      {exportMessage && validationErrors.length === 0 && (
        <div className="designer-success-msg">
          <CheckCircle size={14} /> {exportMessage}
        </div>
      )}
    </div>
  );
}

function ErrorItem({ error }: { error: ValidationError }) {
  const selectEntity = useDesignerStore((s) => s.selectEntity);
  const selectRelationship = useDesignerStore((s) => s.selectRelationship);

  const handleClick = () => {
    if (error.entityId) {
      selectEntity(error.entityId);
    } else if (error.relationshipId) {
      selectRelationship(error.relationshipId);
    }
  };

  const isClickable = error.entityId || error.relationshipId;

  return (
    <span
      className={isClickable ? 'designer-error-link' : ''}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter') handleClick(); } : undefined}
    >
      {error.message}
    </span>
  );
}
