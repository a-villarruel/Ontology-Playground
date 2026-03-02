import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Github, ExternalLink, Copy, Check, AlertTriangle, Loader } from 'lucide-react';
import { useDesignerStore } from '../../store/designerStore';
import { serializeToRDF } from '../../lib/rdf/serializer';
import {
  getStoredToken,
  clearToken,
  startDeviceFlow,
  pollForToken,
  getUser,
  submitToCatalogue,
  type GitHubUser,
  type CatalogueMetadata,
  type DeviceCodeResponse,
} from '../../lib/github';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

// Category options matching the existing catalogue schema
const CATEGORIES = [
  'retail',
  'healthcare',
  'finance',
  'manufacturing',
  'education',
  'technology',
  'logistics',
  'energy',
  'other',
];

interface SubmitCatalogueModalProps {
  onClose: () => void;
}

type Step = 'auth' | 'metadata' | 'submitting' | 'done' | 'error' | 'download';

export function SubmitCatalogueModal({ onClose }: SubmitCatalogueModalProps) {
  const ontology = useDesignerStore((s) => s.ontology);

  // Auth state
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Form state
  const [name, setName] = useState(ontology.name);
  const [description, setDescription] = useState(ontology.description);
  const [icon, setIcon] = useState('📦');
  const [category, setCategory] = useState('other');
  const [tags, setTags] = useState('');

  // Flow state — skip auth entirely when no client ID is configured
  const hasOAuth = !!GITHUB_CLIENT_ID;
  const [step, setStep] = useState<Step>(hasOAuth ? 'auth' : 'download');
  const [error, setError] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    if (!hasOAuth) return;
    const token = getStoredToken();
    if (token) {
      getUser(token)
        .then((u) => {
          setUser(u);
          setStep('metadata');
        })
        .catch(() => {
          clearToken();
          // stay on auth step
        });
    }
  }, [hasOAuth]);

  // Cleanup abort controller
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleStartAuth = useCallback(async () => {
    try {
      const dc = await startDeviceFlow(GITHUB_CLIENT_ID);
      setDeviceCode(dc);

      // Start polling in background
      const controller = new AbortController();
      abortRef.current = controller;

      pollForToken(GITHUB_CLIENT_ID, dc.device_code, dc.interval, dc.expires_in, controller.signal)
        .then(async (token) => {
          const u = await getUser(token);
          setUser(u);
          setStep('metadata');
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setError(err.message);
            setStep('error');
          }
        });
    } catch (err) {
      setError((err as Error).message);
      setStep('error');
    }
  }, []);

  const handleCopyCode = useCallback(() => {
    if (deviceCode?.user_code) {
      navigator.clipboard.writeText(deviceCode.user_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }, [deviceCode]);

  const handleSignOut = useCallback(() => {
    clearToken();
    setUser(null);
    setDeviceCode(null);
    setStep('auth');
  }, []);

  const handleSubmit = useCallback(async () => {
    const token = getStoredToken();
    if (!token || !user) return;

    setStep('submitting');
    setError(null);

    try {
      const rdf = serializeToRDF(ontology, []);
      const slug = ontology.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'my-ontology';

      const metadata: CatalogueMetadata = {
        name,
        description,
        icon,
        category,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        author: user.login,
      };

      const result = await submitToCatalogue(token, rdf, metadata, slug);
      setPrUrl(result.prUrl);
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
      setStep('error');
    }
  }, [ontology, user, name, description, icon, category, tags]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content submit-catalogue-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <h2 className="modal-title">
          <Github size={20} /> Submit to Catalogue
        </h2>

        {/* Step: Auth */}
        {step === 'auth' && !deviceCode && (
          <div className="submit-step">
            <p className="submit-description">
              Sign in with GitHub to submit your ontology as a pull request to the community catalogue.
            </p>
            <button className="designer-action-btn primary" onClick={handleStartAuth}>
              <Github size={14} /> Sign in with GitHub
            </button>
            <div className="submit-fallback">
              <p>Or download the RDF and submit a PR manually:</p>
              <DownloadFallback ontology={ontology} />
            </div>
          </div>
        )}

        {/* Step: Auth — device code shown */}
        {step === 'auth' && deviceCode && (
          <div className="submit-step">
            <p className="submit-description">
              Go to <a href={deviceCode.verification_uri} target="_blank" rel="noopener noreferrer">
                {deviceCode.verification_uri} <ExternalLink size={12} />
              </a> and enter this code:
            </p>
            <div className="device-code-display">
              <code className="device-code">{deviceCode.user_code}</code>
              <button className="designer-action-btn secondary small" onClick={handleCopyCode}>
                {codeCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p className="submit-hint">Waiting for authorization…</p>
            <Loader size={16} className="spinner" />
          </div>
        )}

        {/* Step: Metadata form */}
        {step === 'metadata' && user && (
          <div className="submit-step">
            <div className="submit-user-info">
              <img src={user.avatar_url} alt="" className="submit-avatar" width={24} height={24} />
              <span>Signed in as <strong>{user.login}</strong></span>
              <button className="designer-action-btn secondary small" onClick={handleSignOut}>
                Sign out
              </button>
            </div>

            <div className="submit-form">
              <label className="submit-label">
                Name
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Ontology" />
              </label>

              <label className="submit-label">
                Description
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="A brief description…" />
              </label>

              <div className="submit-form-row">
                <label className="submit-label">
                  Icon
                  <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className="submit-icon-input" />
                </label>

                <label className="submit-label">
                  Category
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="submit-label">
                Tags <span className="submit-hint-inline">(comma-separated)</span>
                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="demo, fabric-iq, supply-chain" />
              </label>
            </div>

            <div className="submit-form-actions">
              <button className="designer-action-btn secondary" onClick={onClose}>Cancel</button>
              <button
                className="designer-action-btn primary"
                onClick={handleSubmit}
                disabled={!name.trim()}
              >
                <Github size={14} /> Create Pull Request
              </button>
            </div>
          </div>
        )}

        {/* Step: Submitting */}
        {step === 'submitting' && (
          <div className="submit-step submit-center">
            <Loader size={24} className="spinner" />
            <p>Forking repo, creating branch, committing files…</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && prUrl && (
          <div className="submit-step submit-center">
            <Check size={32} className="submit-success-icon" />
            <p className="submit-success-text">Pull request created!</p>
            <a href={prUrl} target="_blank" rel="noopener noreferrer" className="designer-action-btn primary">
              <ExternalLink size={14} /> View Pull Request
            </a>
            <button className="designer-action-btn secondary" onClick={onClose} style={{ marginTop: 8 }}>
              Close
            </button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="submit-step submit-center">
            <AlertTriangle size={24} className="submit-error-icon" />
            <p className="submit-error-text">{error}</p>
            <div className="submit-form-actions">
              <button className="designer-action-btn secondary" onClick={() => { setError(null); setStep(user ? 'metadata' : 'auth'); }}>
                Try Again
              </button>
              <button className="designer-action-btn secondary" onClick={onClose}>Close</button>
            </div>
            <div className="submit-fallback">
              <p>Or download the RDF and submit a PR manually:</p>
              <DownloadFallback ontology={ontology} />
            </div>
          </div>
        )}

        {/* Step: Download only (no OAuth configured) */}
        {step === 'download' && (
          <div className="submit-step">
            <p className="submit-description">
              Download your ontology as an RDF file and submit it as a pull request to the
              {' '}<a href="https://github.com/microsoft/Ontology-Playground" target="_blank" rel="noopener noreferrer">
                community catalogue <ExternalLink size={12} />
              </a>.
            </p>
            <p className="submit-hint">
              Place the file under <code>catalogue/community/your-name/</code> and open a PR.
            </p>
            <DownloadFallback ontology={ontology} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Fallback: download RDF + metadata files manually. */
function DownloadFallback({ ontology }: { ontology: ReturnType<typeof useDesignerStore.getState>['ontology'] }) {
  const handleDownload = () => {
    const rdf = serializeToRDF(ontology, []);
    const slug = ontology.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ontology';
    const blob = new Blob([rdf], { type: 'application/rdf+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.rdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button className="designer-action-btn secondary" onClick={handleDownload}>
      Download RDF
    </button>
  );
}
