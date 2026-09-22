            onOrganizationDeleted={() => void handleOrganizationDeleted()}
            accentColor={accentColor}
            onAccentColorChange={changeAccentColor}
          />
        )}
      </main>
    </div>
  );
}

function OrganizationHome({
  organization,
  projects,
  onSelectProject,
  newProjectOpen,
  onNewProjectOpen,
  onCreateProject,
}: {
  organization: Organization;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  newProjectOpen: boolean;
  onNewProjectOpen: (open: boolean) => void;
  onCreateProject: (name: string, description: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...projects]
      .filter((item) => !normalizedQuery || [item.name, item.slug, item.description, item.github_repo ?? ''].join(' ').toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, query]);

  return (
    <section className="organization-home">
      <div className="organization-home-main">
        <div className="organization-page-heading">
          <div>
            <span className="eyebrow">ORGANIZATION</span>
            <h1>Projects</h1>
          </div>
          <button type="button" className="primary-button organization-new-project-button" onClick={() => onNewProjectOpen(!newProjectOpen)}>
            + New project
          </button>
        </div>

        <div className="organization-project-toolbar">
          <label className="organization-project-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a project" />
          </label>
          <button type="button" className="organization-filter-button" disabled>All projects <span>·</span></button>
          <button type="button" className={layout === 'grid' ? 'organization-view-button active' : 'organization-view-button'} onClick={() => setLayout('grid')} aria-label="Grid view">▦</button>
          <button type="button" className={layout === 'list' ? 'organization-view-button active' : 'organization-view-button'} onClick={() => setLayout('list')} aria-label="List view">≡</button>
        </div>

        {newProjectOpen && (
          <OrganizationNewProjectForm
            onCancel={() => onNewProjectOpen(false)}
            onCreate={async (name, description) => {
              const created = await onCreateProject(name, description);
              if (created) setQuery('');
            }}
          />
        )}

        {filteredProjects.length === 0 ? (
          <div className="organization-empty-panel">
            <strong>{projects.length === 0 ? 'No projects yet.' : 'No projects match your search.'}</strong>
            <span>{projects.length === 0 ? `Create the first project in ${organization.name}.` : 'Try a different project name or slug.'}</span>
          </div>
        ) : (
          <div className={layout === 'grid' ? 'organization-project-grid' : 'organization-project-list'}>
            {filteredProjects.map((item) => (
              <button type="button" className="organization-project-card" key={item.id} onClick={() => onSelectProject(item)}>
                <div className="organization-project-card-heading">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.slug}</span>
                  </div>
                  <span className="organization-project-menu">⋮</span>
                </div>
                <p>{item.description || 'No project description.'}</p>
                <div className="organization-project-meta">
                  <span>{item.github_repo ? 'GitHub connected' : 'No GitHub connection'}</span>
                  <span>Open project →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="organization-usage-card">
        <div>
          <span className="eyebrow">ORGANIZATION</span>
          <h2>{organization.name}</h2>
          <p>Select a project to enter its development area. Projects keep their Wiki, Bug Tracker, Builds, GitHub, and Timeline data separate.</p>
        </div>

        <div className="organization-usage-section">
          <div className="organization-usage-heading">
            <span>Projects</span>
            <strong>{projects.length}</strong>
          </div>
          <div className="organization-usage-list">
            {projects.length > 0 ? (
              projects.map((item) => (
                <button
                  type="button"
                  className="organization-usage-item"
                  key={item.id}
                  onClick={() => onSelectProject(item)}
                >
                  <span>{item.name}</span>
                  <span>→</span>
                </button>
              ))
            ) : (
              <span className="organization-usage-empty">No projects yet.</span>
            )}
          </div>
        </div>

        <div className="organization-usage-section">
          <div className="organization-usage-heading">
            <span>GitHub repositories</span>
            <strong>{projects.filter((item) => Boolean(item.github_repo)).length}</strong>
          </div>
          <div className="organization-usage-list">
            {projects.filter((item) => Boolean(item.github_repo)).length > 0 ? (
              projects
                .filter((item): item is Project & { github_repo: string } => Boolean(item.github_repo))
                .map((item) => (
                  <a
                    className="organization-usage-item organization-usage-repository"
                    key={item.id}
                    href={`https://github.com/${item.github_repo}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{item.github_repo}</span>
                    <span>↗</span>
                  </a>
                ))
            ) : (
              <span className="organization-usage-empty">No repositories connected.</span>
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}

function OrganizationNewProjectForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
