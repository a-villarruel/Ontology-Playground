import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, BookOpen, ChevronRight, Sun, Moon, FlaskConical, GraduationCap, Play, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { navigate } from '../lib/router';
import type { Route } from '../lib/router';
import type { LearnManifest, LearnCourse, LearnArticle } from '../types/learn';
import type { Catalogue } from '../types/catalogue';

interface LearnPageProps {
  route: Route & { page: 'learn' };
}

export function LearnPage({ route }: LearnPageProps) {
  const { darkMode, toggleDarkMode } = useAppStore();
  const [manifest, setManifest] = useState<LearnManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Scroll to top when navigating
  useEffect(() => {
    pageRef.current?.scrollTo(0, 0);
  }, [route.courseSlug, route.articleSlug]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}learn.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json() as Promise<LearnManifest>;
      })
      .then(setManifest)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className={`learn-page ${darkMode ? '' : 'light-theme'}`}>
        <div className="learn-error">Failed to load learning content: {error}</div>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className={`learn-page ${darkMode ? '' : 'light-theme'}`}>
        <div className="learn-loading">Loading…</div>
      </div>
    );
  }

  const course = route.courseSlug
    ? manifest.courses.find((c) => c.slug === route.courseSlug)
    : null;

  const article = course && route.articleSlug
    ? course.articles.find((a) => a.slug === route.articleSlug)
    : null;

  // Determine back button behavior
  let backLabel: string;
  let backAction: () => void;
  if (article && course) {
    backLabel = course.title;
    backAction = () => navigate({ page: 'learn', courseSlug: course.slug });
  } else if (course) {
    backLabel = 'All courses';
    backAction = () => navigate({ page: 'learn' });
  } else {
    backLabel = 'Playground';
    backAction = () => navigate({ page: 'home' });
  }

  return (
    <div ref={pageRef} className={`learn-page ${darkMode ? '' : 'light-theme'}`}>
      <header className="learn-header">
        <button
          className="learn-back-btn"
          onClick={backAction}
          title={`Back to ${backLabel}`}
        >
          <ArrowLeft size={20} />
          <span>{backLabel}</span>
        </button>
        <div className="learn-header-title">
          <BookOpen size={20} />
          <span>Learn</span>
        </div>
        <button className="icon-btn" onClick={toggleDarkMode} title="Toggle Theme">
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {article && course ? (
        <ArticleView article={article} course={course} darkMode={darkMode} />
      ) : course ? (
        <CourseDetail course={course} />
      ) : (
        <CourseCatalogue courses={manifest.courses} />
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Course Catalogue (top-level index)
// -------------------------------------------------------------------

function CourseCatalogue({ courses }: { courses: LearnCourse[] }) {
  return (
    <div className="learn-index">
      <div className="learn-index-hero">
        <h1>Learn</h1>
        <p>
          Learning paths and hands-on labs to help you understand and build
          ontologies for Microsoft Fabric IQ.
        </p>
      </div>
      <div className="learn-card-grid">
        {courses.map((c) => (
          <button
            key={c.slug}
            className="learn-card"
            onClick={() => navigate({ page: 'learn', courseSlug: c.slug })}
          >
            <div className="learn-card-header">
              <span className="learn-card-icon">{c.icon}</span>
              <span className={`learn-card-badge learn-card-badge--${c.type}`}>
                {c.type === 'lab' ? <FlaskConical size={12} /> : <GraduationCap size={12} />}
                {c.type === 'lab' ? 'Lab' : 'Path'}
              </span>
            </div>
            <h2>{c.title}</h2>
            <p>{c.description}</p>
            <span className="learn-card-meta">
              {c.articles.length} {c.type === 'lab' ? 'steps' : 'articles'}
            </span>
            <span className="learn-card-cta">
              {c.type === 'lab' ? 'Start lab' : 'Start learning'} <ChevronRight size={16} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Course Detail (article list within a course)
// -------------------------------------------------------------------

function CourseDetail({ course }: { course: LearnCourse }) {
  return (
    <div className="learn-index">
      <div className="learn-index-hero">
        <div className="learn-course-header">
          <span className="learn-course-icon">{course.icon}</span>
          <span className={`learn-card-badge learn-card-badge--${course.type}`}>
            {course.type === 'lab' ? <FlaskConical size={12} /> : <GraduationCap size={12} />}
            {course.type === 'lab' ? 'Lab' : 'Learning Path'}
          </span>
        </div>
        <h1>{course.title}</h1>
        <p>{course.description}</p>
      </div>
      <div className="learn-card-grid">
        {course.articles.map((a) => (
          <button
            key={a.slug}
            className="learn-card"
            onClick={() => navigate({ page: 'learn', courseSlug: course.slug, articleSlug: a.slug })}
          >
            <span className="learn-card-order">
              {course.type === 'lab' ? `Step ${a.order}` : a.order}
            </span>
            <h2>{a.title}</h2>
            <p>{a.description}</p>
            <span className="learn-card-cta">
              {course.type === 'lab' ? 'Open step' : 'Read article'} <ChevronRight size={16} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Article View
// -------------------------------------------------------------------

function ArticleView({
  article,
  course,
  darkMode,
}: {
  article: LearnArticle;
  course: LearnCourse;
  darkMode: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [presenting, setPresenting] = useState(false);

  const nextArticle = useMemo(
    () => course.articles.find((a) => a.order === article.order + 1),
    [course.articles, article.order],
  );
  const prevArticle = useMemo(
    () => course.articles.find((a) => a.order === article.order - 1),
    [course.articles, article.order],
  );

  // Replace <ontology-embed> placeholders with live widgets
  useEffect(() => {
    if (!contentRef.current) return;
    const placeholders = contentRef.current.querySelectorAll('ontology-embed');
    for (const el of placeholders) {
      const id = el.getAttribute('id');
      const height = el.getAttribute('height') || '400px';
      const diff = el.getAttribute('diff') || '';
      if (!id) continue;
      const wrapper = document.createElement('div');
      wrapper.className = 'learn-embed-slot';
      wrapper.style.height = height;
      wrapper.dataset.catalogueId = id;
      wrapper.dataset.theme = darkMode ? 'dark' : 'light';
      if (diff) wrapper.dataset.diffId = diff;
      el.replaceWith(wrapper);
    }
  }, [article.slug, darkMode]);

  // Hydrate embed slots with real ontology data
  useEffect(() => {
    if (!contentRef.current) return;
    const slots = contentRef.current.querySelectorAll<HTMLElement>('.learn-embed-slot');
    if (slots.length === 0) return;

    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}catalogue.json`)
      .then((res) => res.json() as Promise<Catalogue>)
      .then((catalogue) => {
        if (cancelled) return;
        for (const slot of slots) {
          const id = slot.dataset.catalogueId;
          const diffId = slot.dataset.diffId;
          const entry = catalogue.entries.find((e) => e.id === id);
          if (!entry) {
            slot.innerHTML = `<div class="learn-embed-error">Ontology "${id}" not found in catalogue</div>`;
            continue;
          }
          // Find the previous-step entry for diff
          const prevEntry = diffId ? catalogue.entries.find((e) => e.id === diffId) : undefined;

          // Compute diff: which entity/relationship IDs are new vs the previous step
          let newEntityIds: Set<string> | undefined;
          let newRelIds: Set<string> | undefined;
          if (prevEntry) {
            const prevEntIds = new Set(prevEntry.ontology.entityTypes.map((et) => et.id));
            const prevRelIds = new Set(prevEntry.ontology.relationships.map((r) => r.id));
            newEntityIds = new Set(entry.ontology.entityTypes.filter((et) => !prevEntIds.has(et.id)).map((et) => et.id));
            newRelIds = new Set(entry.ontology.relationships.filter((r) => !prevRelIds.has(r.id)).map((r) => r.id));
          }
          renderEmbedSlot(slot, entry, darkMode, newEntityIds, newRelIds, prevEntry);
        }
      })
      .catch(() => {
        if (cancelled) return;
        for (const slot of slots) {
          slot.innerHTML = '<div class="learn-embed-error">Failed to load catalogue</div>';
        }
      });
    return () => { cancelled = true; };
  }, [article.slug, darkMode]);

  return (
    <div className="learn-article">
      <div className="learn-article-toolbar">
        <button
          className="learn-present-btn"
          onClick={() => setPresenting(true)}
          title="Present as slides"
        >
          <Play size={16} />
          <span>Present</span>
        </button>
      </div>
      <article className="learn-article-content" ref={contentRef}>
        <h1>{article.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: article.html }} />
      </article>
      {presenting && (
        <PresentationMode
          article={article}
          darkMode={darkMode}
          onClose={() => setPresenting(false)}
        />
      )}
      <nav className="learn-article-nav">
        {prevArticle ? (
          <button
            className="learn-nav-btn learn-nav-prev"
            onClick={() => navigate({ page: 'learn', courseSlug: course.slug, articleSlug: prevArticle.slug })}
          >
            <ArrowLeft size={16} />
            <div>
              <span className="learn-nav-label">Previous</span>
              <span className="learn-nav-title">{prevArticle.title}</span>
            </div>
          </button>
        ) : (
          <div />
        )}
        {nextArticle && (
          <button
            className="learn-nav-btn learn-nav-next"
            onClick={() => navigate({ page: 'learn', courseSlug: course.slug, articleSlug: nextArticle.slug })}
          >
            <div>
              <span className="learn-nav-label">Next</span>
              <span className="learn-nav-title">{nextArticle.title}</span>
            </div>
            <ChevronRight size={16} />
          </button>
        )}
      </nav>
    </div>
  );
}

// -------------------------------------------------------------------
// Presentation mode — splits article HTML into slides at <h2> boundaries
// -------------------------------------------------------------------

/** Split compiled HTML into slides. Each <h2> starts a new slide.
 *  Content before the first <h2> becomes the title slide.
 *  An <hr> within a section also creates an additional split. */
function splitIntoSlides(html: string, title: string): string[] {
  const container = document.createElement('div');
  container.innerHTML = html;
  const slides: string[] = [];
  let currentSlide = document.createElement('div');

  // Title slide gets the article's h1
  const titleSlide = document.createElement('div');
  titleSlide.innerHTML = `<h1>${title}</h1>`;

  for (const child of Array.from(container.childNodes)) {
    const el = child as HTMLElement;
    if (el.nodeType === Node.ELEMENT_NODE && el.tagName === 'H2') {
      // Flush the current slide
      const content = currentSlide.innerHTML.trim();
      if (content) {
        if (slides.length === 0) {
          // Prepend title to content before first h2
          titleSlide.innerHTML += content;
        } else {
          slides.push(content);
        }
      }
      if (slides.length === 0) {
        slides.push(titleSlide.innerHTML);
      }
      // Start new slide with this h2
      currentSlide = document.createElement('div');
      currentSlide.appendChild(el.cloneNode(true));
    } else if (el.nodeType === Node.ELEMENT_NODE && el.tagName === 'HR') {
      // <hr> forces a slide split within a section
      const content = currentSlide.innerHTML.trim();
      if (content) slides.push(content);
      currentSlide = document.createElement('div');
    } else {
      currentSlide.appendChild(el.cloneNode(true));
    }
  }
  // Flush remaining content
  const remaining = currentSlide.innerHTML.trim();
  if (remaining) slides.push(remaining);

  // Edge case: no h2 elements at all — wrap everything as a single slide
  if (slides.length === 0) {
    slides.push(`<h1>${title}</h1>${html}`);
  }

  return slides;
}

function PresentationMode({
  article,
  darkMode: initialDarkMode,
  onClose,
}: {
  article: LearnArticle;
  darkMode: boolean;
  onClose: () => void;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [presenterDark, setPresenterDark] = useState(initialDarkMode);
  const slideRef = useRef<HTMLDivElement>(null);
  const slides = useMemo(() => splitIntoSlides(article.html, article.title), [article.html, article.title]);
  const total = slides.length;

  const goNext = useCallback(() => setSlideIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const goPrev = useCallback(() => setSlideIndex((i) => Math.max(i - 1, 0)), []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Home') { e.preventDefault(); setSlideIndex(0); }
      else if (e.key === 'End') { e.preventDefault(); setSlideIndex(total - 1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goNext, goPrev, total]);

  // Hydrate ontology embeds when slide changes
  useEffect(() => {
    if (!slideRef.current) return;
    const placeholders = slideRef.current.querySelectorAll('ontology-embed');
    for (const el of placeholders) {
      const id = el.getAttribute('id');
      const height = el.getAttribute('height') || '350px';
      const diff = el.getAttribute('diff') || '';
      if (!id) continue;
      const wrapper = document.createElement('div');
      wrapper.className = 'learn-embed-slot';
      wrapper.style.height = height;
      wrapper.dataset.catalogueId = id;
      wrapper.dataset.theme = presenterDark ? 'dark' : 'light';
      if (diff) wrapper.dataset.diffId = diff;
      el.replaceWith(wrapper);
    }
    // Hydrate
    const slots = slideRef.current.querySelectorAll<HTMLElement>('.learn-embed-slot');
    if (slots.length === 0) return;
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}catalogue.json`)
      .then((res) => res.json() as Promise<Catalogue>)
      .then((catalogue) => {
        if (cancelled) return;
        for (const slot of slots) {
          const id = slot.dataset.catalogueId;
          const diffId = slot.dataset.diffId;
          const entry = catalogue.entries.find((e) => e.id === id);
          if (!entry) continue;
          const prevEntry = diffId ? catalogue.entries.find((e) => e.id === diffId) : undefined;
          let newEntityIds: Set<string> | undefined;
          let newRelIds: Set<string> | undefined;
          if (prevEntry) {
            const prevEntIds = new Set(prevEntry.ontology.entityTypes.map((et) => et.id));
            const prevRelIdSet = new Set(prevEntry.ontology.relationships.map((r) => r.id));
            newEntityIds = new Set(entry.ontology.entityTypes.filter((et) => !prevEntIds.has(et.id)).map((et) => et.id));
            newRelIds = new Set(entry.ontology.relationships.filter((r) => !prevRelIdSet.has(r.id)).map((r) => r.id));
          }
          renderEmbedSlot(slot, entry, presenterDark, newEntityIds, newRelIds, prevEntry);
        }
      });
    return () => { cancelled = true; };
  }, [slideIndex, presenterDark]);

  return (
    <div className={`presentation-overlay ${presenterDark ? '' : 'light-theme'}`}>
      <div className="presentation-chrome">
        <button className="presentation-close" onClick={onClose} title="Exit (Esc)">
          <X size={20} />
        </button>
        <button
          className="presentation-theme-toggle"
          onClick={() => setPresenterDark((d) => !d)}
          title="Toggle theme"
        >
          {presenterDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="presentation-stage">
        <button
          className="presentation-nav presentation-nav--prev"
          onClick={goPrev}
          disabled={slideIndex === 0}
          aria-label="Previous slide"
        >
          <ArrowLeft size={28} />
        </button>

        <div className="presentation-slide-wrapper">
          <div
            ref={slideRef}
            className="presentation-slide learn-article-content"
            key={slideIndex}
            dangerouslySetInnerHTML={{ __html: slides[slideIndex] }}
          />
        </div>

        <button
          className="presentation-nav presentation-nav--next"
          onClick={goNext}
          disabled={slideIndex === total - 1}
          aria-label="Next slide"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      <div className="presentation-footer">
        <div className="presentation-progress">
          <div
            className="presentation-progress-bar"
            style={{ width: `${((slideIndex + 1) / total) * 100}%` }}
          />
        </div>
        <span className="presentation-counter">{slideIndex + 1} / {total}</span>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Inline embed renderer (lightweight — uses cytoscape directly)
// -------------------------------------------------------------------

interface EmbedOntology {
  entityTypes: Array<{ id: string; name: string; icon: string; color: string }>;
  relationships: Array<{ id: string; name: string; from: string; to: string }>;
}

type EmbedEntry = { name: string; ontology: EmbedOntology };

/** Shared chessboard background CSS (mirrors .graph-container in app.css) — fully opaque */
function applyChessboardBg(el: HTMLElement, darkMode: boolean) {
  const dark = darkMode ? '#0F1625' : '#DAE2F0';
  const light = darkMode ? '#1A2840' : '#EEF2FB';
  el.style.backgroundImage = [
    `linear-gradient(45deg, ${dark} 25%, transparent 25%)`,
    `linear-gradient(-45deg, ${dark} 25%, transparent 25%)`,
    `linear-gradient(45deg, transparent 75%, ${dark} 75%)`,
    `linear-gradient(-45deg, transparent 75%, ${dark} 75%)`,
  ].join(',');
  el.style.backgroundSize = '40px 40px';
  el.style.backgroundPosition = '0 0, 0 20px, 20px -20px, -20px 0px';
  el.style.backgroundColor = light;
}

/** Build the shared Cytoscape style array */
function cyStyles(colors: { nodeText: string; edgeColor: string; edgeText: string }, newHighlight: string) {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'bottom' as const,
        'text-halign': 'center' as const,
        'font-size': '11px',
        'font-family': 'Segoe UI, sans-serif',
        'font-weight': 600,
        color: colors.nodeText,
        'text-margin-y': 6,
        width: 48,
        height: 48,
        'background-color': 'data(color)',
        'border-width': 2,
        'border-color': 'data(color)',
        'border-opacity': 0.5,
      },
    },
    {
      selector: 'node.new',
      style: {
        'border-width': 4,
        'border-color': newHighlight,
        'border-opacity': 1,
      },
    },
    {
      selector: 'edge',
      style: {
        label: 'data(label)',
        'font-size': '9px',
        'font-family': 'Segoe UI, sans-serif',
        color: colors.edgeText,
        'text-rotation': 'autorotate' as const,
        'text-margin-y': -12,
        'text-background-color': colors.nodeText === '#B3B3B3' ? '#1E1E1E' : '#FCFCFC',
        'text-background-opacity': 0.7,
        'text-background-padding': '2px',
        width: 1.5,
        'line-color': colors.edgeColor,
        'target-arrow-color': colors.edgeColor,
        'target-arrow-shape': 'triangle' as const,
        'curve-style': 'bezier' as const,
      },
    },
    {
      selector: 'edge.new',
      style: {
        width: 3,
        'line-color': newHighlight,
        'target-arrow-color': newHighlight,
        'line-style': 'solid' as const,
      },
    },
  ];
}

let fcoseRegistered = false;

/** Mount a Cytoscape instance into a container div.
 *  If `fixedPositions` covers every node, uses instant `preset` layout.
 *  Otherwise uses fcose. Returns a promise with the cy instance. */
function mountGraph(
  container: HTMLElement,
  entry: EmbedEntry,
  darkMode: boolean,
  newEntityIds?: Set<string>,
  newRelIds?: Set<string>,
  fixedPositions?: Map<string, { x: number; y: number }>,
): Promise<CyInstance> {
  const newHighlight = '#00C853';
  const nodeIds = entry.ontology.entityTypes.map((e) => e.id);
  const allFixed = fixedPositions != null && nodeIds.every((id) => fixedPositions.has(id));

  const nodes = entry.ontology.entityTypes.map((e) => {
    const pos = fixedPositions?.get(e.id);
    return {
      data: { id: e.id, label: `${e.icon} ${e.name}`, color: e.color },
      classes: newEntityIds?.has(e.id) ? 'new' : '',
      ...(pos ? { position: { x: pos.x, y: pos.y } } : {}),
    };
  });
  const edges = entry.ontology.relationships.map((r) => ({
    data: { id: r.id, source: r.from, target: r.to, label: r.name },
    classes: newRelIds?.has(r.id) ? 'new' : '',
  }));

  const colors = darkMode
    ? { nodeText: '#B3B3B3', edgeColor: '#505050', edgeText: '#808080' }
    : { nodeText: '#2A2A2A', edgeColor: '#888888', edgeText: '#555555' };

  // When every node has a known position, use preset layout (instant, no solver)
  if (allFixed) {
    return import('cytoscape').then(({ default: cytoscape }) => {
      const cy = cytoscape({
        container,
        elements: [...nodes, ...edges],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style: cyStyles(colors, newHighlight) as any,
        layout: { name: 'preset', fit: true, padding: 30 },
        minZoom: 0.3,
        maxZoom: 3,
        userPanningEnabled: true,
        userZoomingEnabled: true,
        boxSelectionEnabled: false,
      });
      return cy;
    });
  }

  return import('cytoscape').then(({ default: cytoscape }) =>
    import('cytoscape-fcose').then(({ default: fcose }) => {
      if (!fcoseRegistered) {
        cytoscape.use(fcose);
        fcoseRegistered = true;
      }

      const cy = cytoscape({
        container,
        elements: [...nodes, ...edges],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style: cyStyles(colors, newHighlight) as any,
        layout: {
          name: 'fcose',
          animate: false,
          fit: true,
          padding: 30,
          nodeDimensionsIncludeLabels: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        minZoom: 0.3,
        maxZoom: 3,
        userPanningEnabled: true,
        userZoomingEnabled: true,
        boxSelectionEnabled: false,
      });
      return cy;
    }),
  );
}

// Minimal Cytoscape instance type (avoids importing full types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CyInstance {
  nodes: () => { forEach: (fn: (n: { id: () => string; position: () => { x: number; y: number } }) => void) => void };
  resize: () => void;
  fit: (...args: any[]) => void;
}

function renderEmbedSlot(
  slot: HTMLElement,
  entry: EmbedEntry,
  darkMode: boolean,
  newEntityIds?: Set<string>,
  newRelIds?: Set<string>,
  prevEntry?: EmbedEntry,
) {
  const hasNew = (newEntityIds && newEntityIds.size > 0) || (newRelIds && newRelIds.size > 0);
  const hasDiff = !!prevEntry;
  const newHighlight = '#00C853';

  const borderColor = darkMode ? '#404040' : '#C0C0C0';
  slot.style.borderRadius = '8px';
  slot.style.border = `1px solid ${borderColor}`;
  slot.style.overflow = 'hidden';
  slot.innerHTML = '';
  slot.style.display = 'flex';
  slot.style.flexDirection = 'column';
  slot.style.position = 'relative';

  // ── Title bar ──────────────────────────────────────────────────
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `display:flex;align-items:center;gap:8px;padding:8px 12px;font:600 13px/1 'Segoe UI',sans-serif;color:${darkMode ? '#B3B3B3' : '#444'};border-bottom:1px solid ${borderColor};background:${darkMode ? '#252526' : '#F3F3F3'};flex-shrink:0`;

  const titleText = document.createElement('span');
  titleText.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  titleText.textContent = entry.name;
  titleBar.appendChild(titleText);

  // Legend dot
  if (hasNew) {
    const legend = document.createElement('span');
    legend.style.cssText = `display:inline-flex;align-items:center;gap:5px;font:500 11px/1 'Segoe UI',sans-serif;color:${newHighlight};white-space:nowrap`;
    const dot = document.createElement('span');
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${newHighlight};display:inline-block;flex-shrink:0`;
    legend.appendChild(dot);
    const count = (newEntityIds?.size ?? 0) + (newRelIds?.size ?? 0);
    legend.appendChild(document.createTextNode(`${count} new`));
    titleBar.appendChild(legend);
  }

  // Before / After toggle (only when there's a previous step)
  let activeView: 'after' | 'before' = 'after';
  let beforeBtn: HTMLButtonElement | undefined;
  let afterBtn: HTMLButtonElement | undefined;

  // Pre-built graph containers (created once, toggled via display)
  const afterDiv = document.createElement('div');
  afterDiv.style.cssText = 'width:100%;height:100%;position:absolute;inset:0';
  applyChessboardBg(afterDiv, darkMode);

  let beforeDiv: HTMLDivElement | undefined;
  let afterCy: CyInstance | undefined;
  let beforeCy: CyInstance | undefined;

  if (hasDiff) {
    beforeDiv = document.createElement('div');
    beforeDiv.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;display:none';
    applyChessboardBg(beforeDiv, darkMode);

    const toggleGroup = document.createElement('span');
    toggleGroup.style.cssText = 'display:inline-flex;border-radius:4px;overflow:hidden;border:1px solid ' + borderColor + ';flex-shrink:0';

    const makeTgl = (label: string, value: 'before' | 'after') => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `border:none;padding:3px 10px;font:500 11px/1 'Segoe UI',sans-serif;cursor:pointer;transition:background .15s,color .15s`;
      btn.addEventListener('click', () => {
        if (activeView === value) return;
        activeView = value;
        updateToggleStyles();
        showActiveView();
      });
      return btn;
    };

    beforeBtn = makeTgl('Before', 'before');
    afterBtn = makeTgl('After', 'after');
    toggleGroup.appendChild(beforeBtn);
    toggleGroup.appendChild(afterBtn);
    titleBar.appendChild(toggleGroup);
  }

  // Maximize / fullscreen button
  const maximizeBtn = document.createElement('button');
  maximizeBtn.title = 'Toggle fullscreen';
  maximizeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  maximizeBtn.style.cssText = `border:none;background:none;cursor:pointer;color:${darkMode ? '#B3B3B3' : '#666'};padding:2px;display:flex;align-items:center;flex-shrink:0`;
  let isFullscreen = false;
  let savedHeight = '';
  maximizeBtn.addEventListener('click', () => {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      savedHeight = slot.style.height;
      slot.style.cssText = '';
      slot.classList.add('learn-embed-fullscreen');
    } else {
      slot.classList.remove('learn-embed-fullscreen');
      slot.style.height = savedHeight;
    }
    slot.style.borderRadius = isFullscreen ? '0' : '8px';
    slot.style.border = isFullscreen ? 'none' : `1px solid ${borderColor}`;
    slot.style.overflow = 'hidden';
    slot.style.display = 'flex';
    slot.style.flexDirection = 'column';
    slot.style.position = isFullscreen ? 'fixed' : 'relative';
    if (isFullscreen) {
      maximizeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 6l7-7"/></svg>';
    } else {
      maximizeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    }
    // Resize both graphs to fit new container size
    requestAnimationFrame(() => {
      if (afterCy) { afterCy.resize(); afterCy.fit(30); }
      if (beforeCy) { beforeCy.resize(); beforeCy.fit(30); }
    });
  });
  titleBar.appendChild(maximizeBtn);
  slot.appendChild(titleBar);

  // ── Graph area (both views stacked absolutely) ─────────────────
  const graphContainer = document.createElement('div');
  graphContainer.style.cssText = 'flex:1;width:100%;min-height:0;position:relative';
  graphContainer.appendChild(afterDiv);
  if (beforeDiv) graphContainer.appendChild(beforeDiv);
  slot.appendChild(graphContainer);

  function updateToggleStyles() {
    if (!beforeBtn || !afterBtn) return;
    const activeBg = '#0078D4';
    const inactiveBg = darkMode ? '#2D2D2D' : '#FFFFFF';
    const activeCol = '#FFFFFF';
    const inactiveCol = darkMode ? '#888' : '#666';
    beforeBtn.style.background = activeView === 'before' ? activeBg : inactiveBg;
    beforeBtn.style.color = activeView === 'before' ? activeCol : inactiveCol;
    afterBtn.style.background = activeView === 'after' ? activeBg : inactiveBg;
    afterBtn.style.color = activeView === 'after' ? activeCol : inactiveCol;
  }

  // Lazily create the before graph on first toggle (avoids layout in a hidden div)
  let beforeMounting = false;
  function ensureBeforeGraph() {
    if (beforeCy || beforeMounting || !prevEntry || !beforeDiv || !afterCy) return;
    beforeMounting = true;
    // Extract node positions from the after graph
    const afterPositions = new Map<string, { x: number; y: number }>();
    afterCy.nodes().forEach((n) => {
      afterPositions.set(n.id(), n.position());
    });
    // beforeDiv is now visible (display != none), so preset layout works
    mountGraph(beforeDiv, prevEntry, darkMode, undefined, undefined, afterPositions).then((bcy) => {
      beforeCy = bcy;
      beforeMounting = false;
    });
  }

  function showActiveView() {
    afterDiv.style.display = activeView === 'after' ? '' : 'none';
    if (beforeDiv) beforeDiv.style.display = activeView === 'before' ? '' : 'none';
    // Lazily mount the before graph the first time it becomes visible
    if (activeView === 'before') ensureBeforeGraph();
    // Resize the now-visible graph so it fills correctly
    requestAnimationFrame(() => {
      if (activeView === 'after' && afterCy) { afterCy.resize(); afterCy.fit(30); }
      if (activeView === 'before' && beforeCy) { beforeCy.resize(); beforeCy.fit(30); }
    });
  }

  updateToggleStyles();

  // Mount only the "after" graph eagerly; "before" is created lazily on first toggle
  mountGraph(afterDiv, entry, darkMode, newEntityIds, newRelIds).then((cy) => {
    afterCy = cy;
  });
}
