import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { supabase } from './utils/supabase.ts';
import WikiView from './WikiView.tsx';
import './styling/DevDock.css';

type View = 'dashboard' | 'wiki' | 'bugs' | 'builds' | 'github' | 'timeline';

type Organization = { id: string; name: string; slug: string; created_by: string };
type Project = { id: string; name: string; slug: string; description: string; github_repo: string | null; github_branch: string };
type Bug = { id: string; title: string; status: string; priority: string; created_at: string };
type Build = { id: string; version: string; branch: string; original_filename: string | null; file_size: number | null; created_at: string; storage_path: string | null };
type WikiPage = { id: string; title: string; slug: string; content: string; parent_id: string | null; sort_order: number; updated_at: string };
type TimelineEvent = { id: string; event_type: string; title: string; description: string; created_at: string };

const views: Array<{ id: View; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'wiki', label: 'Wiki', icon: 'W' },
  { id: 'bugs', label: 'Bug Tracker', icon: '!' },
  { id: 'builds', label: 'Builds', icon: '↥' },
  { id: 'github', label: 'GitHub', icon: '◉' },
  { id: 'timeline', label: 'Timeline', icon: '↯' },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function DevDock() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('there');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [organizationPickerOpen, setOrganizationPickerOpen] = useState(false);
  const organizationAreaRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [bugs, setBugs] = useState<Bug[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const [newOrganization, setNewOrganization] = useState('');
  const [newBug, setNewBug] = useState('');
  const [selectedWiki, setSelectedWiki] = useState<WikiPage | null>(null);

  const [buildVersion, setBuildVersion] = useState('0.1.0');
  const [buildBranch, setBuildBranch] = useState('main');
  const [buildFile, setBuildFile] = useState<File | null>(null);
  const [buildUploading, setBuildUploading] = useState(false);

  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');

  const activeView = useMemo(
    () => views.find((item) => item.id === view)?.label ?? 'Dashboard',
    [view],
  );

  useEffect(() => {
    function handleDocumentPointer(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (organizationPickerOpen && !organizationAreaRef.current?.contains(target)) {
        setOrganizationPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentPointer);
    return () => document.removeEventListener('mousedown', handleDocumentPointer);
  }, [organizationPickerOpen]);

  useEffect(() => {
    async function initialize() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) return;

        setEmail(user.email ?? '');
        const metadata = user.user_metadata as Record<string, unknown> | null;
        const name = typeof metadata?.name === 'string'
          ? metadata.name
          : typeof metadata?.full_name === 'string'
            ? metadata.full_name
            : 'there';
        setDisplayName(name);
        await loadOrganizations(user.id);
      } catch (initializeError) {
        setError(initializeError instanceof Error ? initializeError.message : 'Could not load your workspace.');
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, []);

  async function loadOrganizations(userId: string) {
    const { data: created, error: createdError } = await supabase
      .from('organizations')
      .select('id,name,slug,created_by')
      .eq('created_by', userId)
      .order('created_at');

    if (createdError) throw createdError;

    const { data: memberships, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId);

    if (membershipError) throw membershipError;

    const ids = (memberships ?? []).map((item: { organization_id: string }) => item.organization_id);
    let joined: Organization[] = [];

    if (ids.length > 0) {
      const { data, error: joinedError } = await supabase
        .from('organizations')
        .select('id,name,slug,created_by')
        .in('id', ids)
        .order('created_at');

      if (joinedError) throw joinedError;
      joined = (data ?? []) as Organization[];
    }

    const merged = [...((created ?? []) as Organization[]), ...joined].filter(
      (item, index, all) => all.findIndex((other) => other.id === item.id) === index,
    );
    setOrganizations(merged);
  }

  async function createOrganization() {
    const name = newOrganization.trim();
    if (!name) return;

    try {
      setError('');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('You are no longer signed in.');

      const baseSlug = slugify(name) || 'organization';
      const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;

      const { data: created, error: createError } = await supabase
        .from('organizations')
        .insert({ name, slug, created_by: user.id })
        .select('id,name,slug,created_by')
        .single();

      if (createError || !created) throw createError ?? new Error('Could not create organization.');

      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({ organization_id: created.id, user_id: user.id, role: 'owner' });

      if (memberError) throw memberError;

      const createdOrganization = created as Organization;
      setOrganizations((current) => [...current, createdOrganization]);
      setNewOrganization('');
      await enterOrganization(createdOrganization);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create organization.');
    }
  }

  async function enterOrganization(nextOrganization: Organization) {
    try {
      setError('');
      setMessage('');
      setWorkspaceLoading(true);
      setOrganization(nextOrganization);
      setOrganizationPickerOpen(false);
      setMenuOpen(false);

      const { data, error: projectError } = await supabase
        .from('projects')
        .select('id,name,slug,description,github_repo,github_branch')
        .eq('organization_id', nextOrganization.id)
        .order('created_at');

      if (projectError) throw projectError;

      let nextProjects = (data ?? []) as Project[];

      if (nextProjects.length === 0) {
        const { data: createdProject, error: createProjectError } = await supabase
          .from('projects')
          .insert({
            organization_id: nextOrganization.id,
            name: 'CurrentGame',
            slug: 'currentgame',
            description: 'Godot 4.7 first-person open-world adventure project.',
            github_repo: 'EverettM12/currentgame',
            github_branch: 'main',
          })
          .select('id,name,slug,description,github_repo,github_branch')
          .single();

        if (createProjectError || !createdProject) {
          throw createProjectError ?? new Error('Could not create the first project.');
        }

        nextProjects = [createdProject as Project];
      }

      setProjects(nextProjects);
      const nextProject = nextProjects[0] ?? null;
      setProject(nextProject);

      if (nextProject) {
        await loadProjectData(nextProject);
      }

      setView('dashboard');
    } catch (organizationError) {
      setOrganization(null);
      setProject(null);
      setProjects([]);
      setError(organizationError instanceof Error ? organizationError.message : 'Could not enter this organization.');
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function loadProjectData(nextProject: Project) {
    const [bugsResult, buildsResult, wikiResult, timelineResult] = await Promise.all([
      supabase.from('bugs').select('id,title,status,priority,created_at').eq('project_id', nextProject.id).order('created_at', { ascending: false }),
      supabase.from('builds').select('id,version,branch,original_filename,file_size,created_at,storage_path').eq('project_id', nextProject.id).order('created_at', { ascending: false }),
      supabase.from('wiki_pages').select('id,title,slug,content,parent_id,updated_at').eq('project_id', nextProject.id).order('updated_at', { ascending: false }),
      supabase.from('timeline_events').select('id,event_type,title,description,created_at').eq('project_id', nextProject.id).order('created_at', { ascending: false }).limit(50),
    ]);

    if (bugsResult.error) throw bugsResult.error;
    if (buildsResult.error) throw buildsResult.error;
    if (wikiResult.error) throw wikiResult.error;
    if (timelineResult.error) throw timelineResult.error;

    const nextWikiPages = (wikiResult.data ?? []) as WikiPage[];
    setBugs((bugsResult.data ?? []) as Bug[]);
    setBuilds((buildsResult.data ?? []) as Build[]);
    setWikiPages(nextWikiPages);
    setTimeline((timelineResult.data ?? []) as TimelineEvent[]);
    setGithubRepo(nextProject.github_repo ?? '');
    setGithubBranch(nextProject.github_branch || 'main');

    const savedWikiId = localStorage.getItem(`test-project:wiki:selected:${nextProject.id}`);
    const savedWiki = nextWikiPages.find((page) => page.id === savedWikiId) ?? null;
    setSelectedWiki(savedWiki);
  }

  async function selectProject(nextProject: Project) {
    try {
      setError('');
      setWorkspaceLoading(true);
      setProject(nextProject);
      setSelectedWiki(null);
      await loadProjectData(nextProject);
    } catch (projectError) {
      setError(projectError instanceof Error ? projectError.message : 'Could not load project.');
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function addTimeline(type: string, title: string, description = '') {
    if (!project) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: timelineError } = await supabase
      .from('timeline_events')
      .insert({ project_id: project.id, event_type: type, title, description, actor_id: user?.id ?? null })
      .select('id,event_type,title,description,created_at')
      .single();

    if (!timelineError && data) {
      setTimeline((current) => [data as TimelineEvent, ...current]);
    }
  }

  async function addBug() {
    const title = newBug.trim();
    if (!project || !title) return;

    try {
      setError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are no longer signed in.');

      const { data, error: insertError } = await supabase
        .from('bugs')
        .insert({ project_id: project.id, title, created_by: user.id })
        .select('id,title,status,priority,created_at')
        .single();

      if (insertError || !data) throw insertError ?? new Error('Could not create bug.');
      setBugs((current) => [data as Bug, ...current]);
      setNewBug('');
      await addTimeline('bug', `Bug created: ${title}`);
    } catch (bugError) {
      setError(bugError instanceof Error ? bugError.message : 'Could not create bug.');
    }
  }

  async function addWikiPage(parentId: string | null = null, requestedTitle?: string): Promise<WikiPage | null> {
    const title = requestedTitle?.trim() ?? '';

    if (!project || !title) {
      return null;
    }

    try {
      setError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are no longer signed in.');

      const orderQuery = parentId === null
        ? supabase
            .from('wiki_pages')
            .select('sort_order')
            .eq('project_id', project.id)
            .is('parent_id', null)
            .order('sort_order', { ascending: false })
            .limit(1)
        : supabase
            .from('wiki_pages')
            .select('sort_order')
            .eq('project_id', project.id)
            .eq('parent_id', parentId)
            .order('sort_order', { ascending: false })
            .limit(1);

      const { data: lastSibling, error: orderError } = await orderQuery;
      if (orderError) throw orderError;

      const sortOrder = ((lastSibling?.[0]?.sort_order as number | undefined) ?? -1) + 1;

      const { data, error: insertError } = await supabase
        .from('wiki_pages')
        .insert({
          project_id: project.id,
          title,
          slug: `${slugify(title) || 'page'}-${crypto.randomUUID().slice(0, 5)}`,
          content: `# ${title}\n\nStart documenting this part of the project.`,
          parent_id: parentId,
          sort_order: sortOrder,
          created_by: user.id,
        })
        .select('id,title,slug,content,parent_id,sort_order,updated_at')
        .single();

      if (insertError || !data) throw insertError ?? new Error('Could not create wiki page.');

      const page = data as WikiPage;
      setWikiPages((current) => [...current, page]);
      selectWikiPage(page);
      await addTimeline('wiki', `Wiki page created: ${title}`);
      return page;
    } catch (wikiError) {
      setError(wikiError instanceof Error ? wikiError.message : 'Could not create wiki page.');
      return null;
    }
  }

  function selectWikiPage(page: WikiPage | null) {
    setSelectedWiki(page);

    if (!project) {
      return;
    }

    const key = `test-project:wiki:selected:${project.id}`;

    if (page) {
      localStorage.setItem(key, page.id);
    } else {
      localStorage.removeItem(key);
    }
  }

  async function saveWikiPage(pageToSave?: WikiPage): Promise<WikiPage | null> {
    const page = pageToSave ?? selectedWiki;

    if (!page) {
      return null;
    }

    try {
      setError('');
      const { data, error: updateError } = await supabase
        .from('wiki_pages')
        .update({
          title: page.title,
          content: page.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', page.id)
        .select('id,title,slug,content,parent_id,sort_order,updated_at')
        .single();

      if (updateError || !data) throw updateError ?? new Error('Could not save wiki page.');

      const updatedPage = data as WikiPage;
      setWikiPages((current) => current.map((item) => item.id === updatedPage.id ? updatedPage : item));
      selectWikiPage(updatedPage);
      setMessage('Wiki page saved.');
      await addTimeline('wiki', `Wiki page updated: ${updatedPage.title}`);
      return updatedPage;
    } catch (wikiError) {
      setError(wikiError instanceof Error ? wikiError.message : 'Could not save wiki page.');
      return null;
    }
  }

  async function deleteWikiPage(page: WikiPage): Promise<boolean> {
    try {
      setError('');

      const { data: children, error: childError } = await supabase
        .from('wiki_pages')
        .select('id')
        .eq('parent_id', page.id)
        .limit(1);

      if (childError) throw childError;

      if ((children ?? []).length > 0) {
        setError('Move or delete this page’s child pages before deleting it.');
        return false;
      }

      const { error: deleteError } = await supabase
        .from('wiki_pages')
        .delete()
        .eq('id', page.id);

      if (deleteError) throw deleteError;

      setWikiPages((current) => current.filter((item) => item.id !== page.id));

      if (selectedWiki?.id === page.id) {
        selectWikiPage(null);
      }

      await addTimeline('wiki', `Wiki page deleted: ${page.title}`);
      setMessage('Wiki page deleted.');
      return true;
    } catch (wikiError) {
      setError(wikiError instanceof Error ? wikiError.message : 'Could not delete wiki page.');
      return false;
    }
  }

  async function moveWikiPage(pageId: string, targetId: string | null, position: 'before' | 'inside' | 'after'): Promise<boolean> {
    if (!project || pageId === targetId) {
      return false;
    }

    try {
      setError('');

      const page = wikiPages.find((item) => item.id === pageId);
      const target = targetId ? wikiPages.find((item) => item.id === targetId) : null;

      if (!page || (targetId && !target)) {
        return false;
      }

      if (targetId) {
        let ancestor: WikiPage | null = target;
        while (ancestor?.parent_id) {
          if (ancestor.parent_id === pageId) {
            setError('A page cannot be moved inside one of its own children.');
            return false;
          }
          ancestor = wikiPages.find((item) => item.id === ancestor?.parent_id);
        }
      }

      const nextParentId = position === 'inside' ? targetId : (target?.parent_id ?? null);
      const siblings = wikiPages
        .filter((item) => item.id !== pageId && item.parent_id === nextParentId)
        .sort((a, b) => a.sort_order - b.sort_order);

      let insertionIndex = siblings.length;

      if (position !== 'inside' && target) {
        const targetIndex = siblings.findIndex((item) => item.id === target.id);
        insertionIndex = targetIndex < 0
          ? siblings.length
          : position === 'before'
            ? targetIndex
            : targetIndex + 1;
      }

      siblings.splice(insertionIndex, 0, {
        ...page,
        parent_id: nextParentId,
        sort_order: 0,
      });

      for (let index = 0; index < siblings.length; index += 1) {
        const item = siblings[index];

        const { error: reorderError } = await supabase
          .from('wiki_pages')
          .update({ sort_order: index })
          .eq('id', item.id);

        if (reorderError) throw reorderError;
      }

      const { error: moveError } = await supabase
        .from('wiki_pages')
        .update({
          parent_id: nextParentId,
          sort_order: insertionIndex,
        })
        .eq('id', page.id);

      if (moveError) throw moveError;

      await loadProjectData(project);
      await addTimeline('wiki', `Wiki page moved: ${page.title}`);
      return true;
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Could not move wiki page.');
      return false;
    }
  }

  function handleBuildFile(event: ChangeEvent<HTMLInputElement>) {
    setBuildFile(event.target.files?.[0] ?? null);
  }

  async function uploadBuild() {
    if (!project || !buildFile) return;

    try {
      setBuildUploading(true);
      setError('');
      setMessage('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are no longer signed in.');

      const safeName = buildFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${project.id}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('builds')
        .upload(storagePath, buildFile, {
          contentType: buildFile.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from('builds')
        .insert({
          project_id: project.id,
          version: buildVersion.trim() || '0.1.0',
          branch: buildBranch.trim() || 'main',
          original_filename: buildFile.name,
          file_size: buildFile.size,
          storage_path: storagePath,
          created_by: user.id,
        })
        .select('id,version,branch,original_filename,file_size,created_at,storage_path')
        .single();

      if (insertError || !data) {
        await supabase.storage.from('builds').remove([storagePath]);
        throw insertError ?? new Error('Could not save build metadata.');
      }

      setBuilds((current) => [data as Build, ...current]);
      setBuildFile(null);
      setMessage('Build uploaded successfully.');
      await addTimeline('build', `Build ${buildVersion.trim() || '0.1.0'} uploaded`, buildFile.name);
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : 'Could not upload build.');
    } finally {
      setBuildUploading(false);
    }
  }

  async function downloadBuild(build: Build) {
    if (!build.storage_path) return;

    try {
      setError('');
      const { data, error: signedUrlError } = await supabase.storage
        .from('builds')
        .createSignedUrl(build.storage_path, 300);

      if (signedUrlError || !data?.signedUrl) {
        throw signedUrlError ?? new Error('Could not create a download link.');
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download this build.');
    }
  }

  async function saveGithub() {
    if (!project || !githubRepo.trim()) return;

    try {
      setError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are no longer signed in.');

      const repo = githubRepo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
      const branch = githubBranch.trim() || 'main';

      const { error: projectError } = await supabase
        .from('projects')
        .update({ github_repo: repo, github_branch: branch })
        .eq('id', project.id);

      if (projectError) throw projectError;

      const { error: connectionError } = await supabase
        .from('github_connections')
        .upsert({ project_id: project.id, repo, branch, connected_by: user.id });

      if (connectionError) throw connectionError;

      const updatedProject = { ...project, github_repo: repo, github_branch: branch };
      setProject(updatedProject);
      setProjects((current) => current.map((item) => item.id === project.id ? updatedProject : item));
      setGithubRepo(repo);
      setGithubBranch(branch);
      setMessage('GitHub repository connected.');
      await addTimeline('github', `GitHub connected: ${repo}`, `Default branch: ${branch}`);
    } catch (githubError) {
      setError(githubError instanceof Error ? githubError.message : 'Could not connect GitHub.');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function switchOrganization() {
    setOrganization(null);
    setProject(null);
    setProjects([]);
    setBugs([]);
    setBuilds([]);
    setWikiPages([]);
    setTimeline([]);
    setSelectedWiki(null);
    setView('dashboard');
    setError('');
    setMessage('');
    setOrganizationPickerOpen(true);
    setMenuOpen(false);
  }

  if (loading) {
    return <div className="devdock-loading">Loading DevDock...</div>;
  }

  if (workspaceLoading) {
    return <div className="devdock-loading">Loading workspace...</div>;
  }

  if (!organization) {
    return (
      <div className="organization-shell">
        <div className="organization-panel">
          <div className="brand-lockup">DevDock</div>
          <span className="eyebrow">YOUR WORKSPACES</span>
          <h1>Choose an organization.</h1>
          <p className="organization-copy">
            Organizations keep people, projects, documentation, builds, and bugs separated.
            You must enter one before you can work inside it.
          </p>
          {error && <div className="error-banner">{error}</div>}
          <div className="organization-list">
            {organizations.map((item) => (
              <button type="button" className="organization-option" key={item.id} onClick={() => void enterOrganization(item)}>
                <div><strong>{item.name}</strong><span>{item.slug}</span></div>
                <span className="organization-arrow">→</span>
              </button>
            ))}
            {organizations.length === 0 && (
              <div className="organization-empty">
                <strong>No organizations yet.</strong>
                <span>Create your first workspace below.</span>
              </div>
            )}
          </div>
          <div className="create-organization">
            <input
              value={newOrganization}
              onChange={(event) => setNewOrganization(event.target.value)}
              placeholder="Organization name"
              onKeyDown={(event) => { if (event.key === 'Enter') void createOrganization(); }}
            />
            <button type="button" className="primary-button" onClick={() => void createOrganization()}>
              Create organization
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="devdock-app">
      <header className="devdock-topbar">
        <button
          type="button"
          className={`menu-button${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Toggle navigation"
        >
          <span /><span /><span />
        </button>

        <div className="brand-lockup">DevDock</div>

        <div className="organization-area" ref={organizationAreaRef}>
        <button
          type="button"
          className="organization-switcher"
          onClick={() => setOrganizationPickerOpen((current) => !current)}
          aria-expanded={organizationPickerOpen}
        >
          <span>{organization.name}</span><span>⌄</span>
        </button>

        {organizationPickerOpen && (
          <div className="organization-popover">
            <div className="popover-heading">Switch organization</div>
            {organizations.map((item) => (
              <button
                type="button"
                className="organization-popover-option"
                key={item.id}
                onClick={() => void enterOrganization(item)}
              >
                {item.name}{item.id === organization.id && <span>✓</span>}
              </button>
            ))}
            <button type="button" className="organization-popover-action" onClick={switchOrganization}>
              Choose from workspace screen
            </button>
          </div>
        )}
      </div>

        <div className="active-project-label">{project?.name ?? 'No project'}</div>
      </header>

      <aside className={`devdock-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-heading">{organization.name}</div>
        <div className="sidebar-label">WORKSPACE</div>

        {views.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-item${view === item.id ? ' active' : ''}`}
            onClick={() => {
              setView(item.id);
              setMenuOpen(false);
              setError('');
              setMessage('');
            }}
          >
            <span>{item.icon}</span>{item.label}
          </button>
        ))}

        <div className="sidebar-label projects-label">PROJECTS</div>

        <div className="project-list">
          {projects.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`project-item${project?.id === item.id ? ' active' : ''}`}
              onClick={() => void selectProject(item)}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="sidebar-spacer" />

        <button type="button" className="sidebar-switcher" onClick={switchOrganization}>Switch organization</button>

        <div className="account-block">
          <strong>{displayName}</strong><span>{email || 'Signed in'}</span>
        </div>

        <button type="button" className="signout-button" onClick={() => void signOut()}>Sign Out</button>
      </aside>

      {menuOpen && (
        <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      )}

      <main className="devdock-main">
        <div className="workspace-header">
          <div>
            <span className="eyebrow">{organization.name}</span>
            <h1>{view === 'dashboard' ? `Welcome, ${displayName}.` : activeView}</h1>
            <p>{project?.name ?? 'Choose a project to get started.'}</p>
          </div>

          {projects.length > 1 && (
            <select
              value={project?.id ?? ''}
              onChange={(event) => {
                const nextProject = projects.find((item) => item.id === event.target.value);
                if (nextProject) void selectProject(nextProject);
              }}
            >
              {projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          )}
        </div>

        {message && <div className="notice-banner">{message}</div>}
        {error && <div className="error-banner">{error}</div>}

        {view === 'dashboard' && (
          <Dashboard project={project} bugs={bugs} builds={builds} wikiPages={wikiPages} timeline={timeline} onView={setView} />
        )}

        {view === 'wiki' && (
          <WikiView
            projectId={project?.id ?? null}
            pages={wikiPages}
            selectedId={selectedWiki?.id ?? null}
            onSelect={selectWikiPage}
            onCreatePage={addWikiPage}
            onSavePage={saveWikiPage}
            onDeletePage={deleteWikiPage}
            onMovePage={moveWikiPage}
          />
        )}

        {view === 'bugs' && (
          <BugsView bugs={bugs} value={newBug} onChange={setNewBug} onCreate={() => void addBug()} />
        )}

        {view === 'builds' && (
          <BuildsView
            builds={builds}
            version={buildVersion}
            branch={buildBranch}
            file={buildFile}
            uploading={buildUploading}
            onVersion={setBuildVersion}
            onBranch={setBuildBranch}
            onFile={handleBuildFile}
            onUpload={() => void uploadBuild()}
            onDownload={(build) => void downloadBuild(build)}
          />
        )}

        {view === 'github' && (
          <GithubView
            repo={githubRepo}
            branch={githubBranch}
            project={project}
            onRepo={setGithubRepo}
            onBranch={setGithubBranch}
            onSave={() => void saveGithub()}
          />
        )}

        {view === 'timeline' && <TimelineView events={timeline} />}
      </main>
    </div>
  );
}

function Dashboard({
  project, bugs, builds, wikiPages, timeline, onView,
}: {
  project: Project | null;
  bugs: Bug[];
  builds: Build[];
  wikiPages: WikiPage[];
  timeline: TimelineEvent[];
  onView: (view: View) => void;
}) {
  const openBugs = bugs.filter((bug) => bug.status !== 'closed' && bug.status !== 'resolved').length;
  const highPriority = bugs.filter((bug) => bug.priority === 'critical' || bug.priority === 'high').length;

  return (
    <div className="dashboard-grid">
      <section className="dock hero-dock">
        <div>
          <span className="dock-kicker">ACTIVE PROJECT</span>
          <h2>{project?.name ?? 'No project'}</h2>
          <p>{project?.description || 'Your development workspace is ready.'}</p>
        </div>
        <button type="button" className="primary-button" onClick={() => onView('timeline')}>View activity</button>
      </section>

      <DashboardDock title="Wiki" icon="W" value={String(wikiPages.length)} detail="pages" onClick={() => onView('wiki')}>
        {wikiPages.slice(0, 3).map((page) => <span key={page.id}>{page.title}</span>)}
        {wikiPages.length === 0 && <span className="muted">No pages yet</span>}
      </DashboardDock>

      <DashboardDock title="Bug Tracker" icon="!" value={String(openBugs)} detail="open bugs" onClick={() => onView('bugs')}>
        <div className="metric-row"><span>Critical / High</span><strong>{highPriority}</strong></div>
      </DashboardDock>

      <DashboardDock title="Builds" icon="↥" value={String(builds.length)} detail="uploaded" onClick={() => onView('builds')}>
        {builds.slice(0, 2).map((build) => <span key={build.id}>v{build.version} · {build.branch}</span>)}
        {builds.length === 0 && <span className="muted">No builds yet</span>}
      </DashboardDock>

      <DashboardDock title="GitHub" icon="◉" value={project?.github_repo ? 'Connected' : 'Not connected'} detail="repository" onClick={() => onView('github')}>
        <span className="github-mini">{project?.github_repo ?? 'Connect a repository'}</span>
      </DashboardDock>

      <DashboardDock title="Timeline" icon="↯" value={String(timeline.length)} detail="recent events" onClick={() => onView('timeline')}>
        <div className="timeline-mini">
          {timeline.slice(0, 3).map((event) => <div key={event.id}><strong>{event.title}</strong><span>{formatDate(event.created_at)}</span></div>)}
          {timeline.length === 0 && <span className="muted">Activity will appear here</span>}
        </div>
      </DashboardDock>

      <section className="dock quick-dock">
        <div>
          <span className="dock-kicker">WORKFLOW</span>
          <h3>Your workspace is ready.</h3>
          <p>Keep documentation, bugs, builds, source control, and project history together.</p>
        </div>
        <div className="quick-actions">
          <button type="button" onClick={() => onView('bugs')}>Report bug</button>
          <button type="button" onClick={() => onView('builds')}>Upload build</button>
          <button type="button" onClick={() => onView('wiki')}>Write docs</button>
        </div>
      </section>
    </div>
  );
}

function DashboardDock({
  title, icon, value, detail, onClick, children,
}: {
  title: string;
  icon: string;
  value: string;
  detail: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="dock dashboard-dock" onClick={onClick}>
      <div className="dock-title"><span className="dock-icon">{icon}</span><span>{title}</span><span className="dock-arrow">→</span></div>
      <div className="dock-stat"><strong>{value}</strong><span>{detail}</span></div>
      <div className="dock-list">{children}</div>
    </button>
  );
}

function BugsView({
  bugs, value, onChange, onCreate,
}: {
  bugs: Bug[];
  value: string;
  onChange: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <section className="content-card">
      <div className="section-head">
        <div>
          <span className="dock-kicker">TRACKING</span>
          <h2>Bug Tracker</h2>
          <p>Start small with status and priority. The issue model is ready to grow into full test reports.</p>
        </div>
        <div className="inline-create">
          <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Describe the bug" onKeyDown={(event) => { if (event.key === 'Enter') onCreate(); }} />
          <button type="button" className="primary-button" onClick={onCreate}>Report</button>
        </div>
      </div>
      <div className="bug-table">
        <div className="table-head"><span>Issue</span><span>Status</span><span>Priority</span><span>Created</span></div>
        {bugs.map((bug) => (
          <div className="table-row" key={bug.id}>
            <strong>{bug.title}</strong>
            <span className="status-pill">{bug.status.replace('_', ' ')}</span>
            <span className={`priority-pill ${bug.priority}`}>{bug.priority}</span>
            <span>{formatDate(bug.created_at)}</span>
          </div>
        ))}
        {bugs.length === 0 && <EmptyState title="No bugs reported" detail="Your first issue will appear here." />}
      </div>
    </section>
  );
}

function BuildsView({
  builds, version, branch, file, uploading, onVersion, onBranch, onFile, onUpload, onDownload,
}: {
  builds: Build[];
  version: string;
  branch: string;
  file: File | null;
  uploading: boolean;
  onVersion: (value: string) => void;
  onBranch: (value: string) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDownload: (build: Build) => void;
}) {
  return (
    <section className="content-card">
      <div className="section-head">
        <div>
          <span className="dock-kicker">ARTIFACTS</span>
          <h2>Builds</h2>
          <p>Upload the actual Windows build you want to hand to testers.</p>
        </div>
      </div>
      <div className="build-upload">
        <input value={version} onChange={(event) => onVersion(event.target.value)} placeholder="Version" />
        <input value={branch} onChange={(event) => onBranch(event.target.value)} placeholder="Branch" />
        <label className="file-picker">
          <input type="file" accept=".exe,.zip,.7z" onChange={onFile} />
          <span>{file?.name ?? 'Choose .exe / .zip / .7z'}</span>
          {file && <small>{formatSize(file.size)}</small>}
        </label>
        <button type="button" className="primary-button" disabled={!file || uploading} onClick={onUpload}>
          {uploading ? 'Uploading...' : 'Upload build'}
        </button>
      </div>
      <div className="resource-list">
        {builds.map((build) => (
          <article className="resource-row build-resource-row" key={build.id}>
            <div><strong>v{build.version}</strong><p>{build.original_filename ?? 'Build artifact'} · {formatSize(build.file_size)} · {build.branch}</p></div>
            <div className="build-actions"><span>{formatDate(build.created_at)}</span><button type="button" onClick={() => onDownload(build)}>Download</button></div>
          </article>
        ))}
        {builds.length === 0 && <EmptyState title="No builds uploaded" detail="Upload an executable or archive to start keeping tester-ready builds here." />}
      </div>
    </section>
  );
}

function GithubView({
  repo, branch, project, onRepo, onBranch, onSave,
}: {
  repo: string;
  branch: string;
  project: Project | null;
  onRepo: (value: string) => void;
  onBranch: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="content-card">
      <div className="section-head">
        <div>
          <span className="dock-kicker">SOURCE CONTROL</span>
          <h2>GitHub Integration</h2>
          <p>Connect the repository for this project. The live commits, branches, pull requests, and issue panels can plug into this connection next.</p>
        </div>
      </div>
      <div className="github-form">
        <label>Repository<input value={repo} onChange={(event) => onRepo(event.target.value)} placeholder="EverettM12/currentgame" /></label>
        <label>Default branch<input value={branch} onChange={(event) => onBranch(event.target.value)} placeholder="main" /></label>
        <button type="button" className="primary-button" onClick={onSave}>Save connection</button>
      </div>
      {project?.github_repo && (
        <div className="github-connected">
          <span className="connected-dot" />
          <strong>{project.github_repo}</strong>
          <span>{project.github_branch}</span>
          <a href={`https://github.com/${project.github_repo}`} target="_blank" rel="noreferrer">Open on GitHub →</a>
        </div>
      )}
      <div className="integration-grid">
        <Integration title="Commits" detail="Live activity dock ready" />
        <Integration title="Branches" detail="Branch browser ready" />
        <Integration title="Pull requests" detail="PR panel ready" />
        <Integration title="Issues" detail="GitHub issue sync ready" />
      </div>
    </section>
  );
}

function Integration({ title, detail }: { title: string; detail: string }) {
  return <div className="integration-card"><strong>{title}</strong><span>{detail}</span><small>Skeleton</small></div>;
}

function TimelineView({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="content-card">
      <div className="section-head">
        <div>
          <span className="dock-kicker">PROJECT HISTORY</span>
          <h2>Timeline</h2>
          <p>One chronological place to see what changed, when it changed, and what was worked on.</p>
        </div>
      </div>
      <div className="timeline">
        {events.map((event) => (
          <article className="timeline-event" key={event.id}>
            <span className="timeline-dot" />
            <div><span>{formatDate(event.created_at)} · {event.event_type}</span><h3>{event.title}</h3>{event.description && <p>{event.description}</p>}</div>
          </article>
        ))}
        {events.length === 0 && <EmptyState title="Timeline is empty" detail="Project activity will appear here as you work." />}
      </div>
    </section>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{detail}</span></div>;
}

export default DevDock;
