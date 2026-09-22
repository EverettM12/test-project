import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { supabase } from './utils/supabase.ts';
import WikiView from './WikiView.tsx';
import WorkspaceView from './WorkspaceView.tsx';
import './styling/DevDock.css';

type View = 'organization' | 'organization-team' | 'organization-integrations' | 'dashboard' | 'wiki' | 'bugs' | 'builds' | 'github' | 'timeline' | 'workspace';

type Organization = { id: string; name: string; slug: string; created_by: string };
type Project = { id: string; name: string; slug: string; description: string; github_repo: string | null; github_branch: string };
type Bug = { id: string; title: string; status: string; priority: string; created_at: string };
type Build = { id: string; version: string; branch: string; original_filename: string | null; file_size: number | null; created_at: string; storage_path: string | null };
type WikiPage = { id: string; title: string; slug: string; content: string; parent_id: string | null; sort_order: number; updated_at: string };
type TimelineEvent = { id: string; event_type: string; title: string; description: string; created_at: string };
type IncomingInvitation = { id: string; organization_id: string; organization_name: string; email: string; role: 'admin' | 'developer' | 'tester' | 'viewer'; expires_at: string };

function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="m4.803 8.824 2.373 2.373h1.648l2.373-2.373V7.176L8.824 4.803H7.176L4.803 7.175zm4.894-1.027L8.203 6.303h-.406L6.303 7.796v.406l1.495 1.495h.405l1.494-1.495v-.406Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M9.464.25H6.537L5.322 2.68l-.59.34-2.712-.162L.557 5.392l1.497 2.269v.678L.557 10.607l1.463 2.535 2.712-.162.59.34 1.215 2.43h2.927l1.214-2.429.592-.341 2.71.162 1.463-2.534-1.496-2.266v-.684l1.496-2.266-1.463-2.534-2.71.162-.591-.34L9.463.25ZM6.462 3.753 7.464 1.75h1.073l1.001 2.003 1.371.792 2.235-.135.537.93-1.234 1.868v1.584l1.234 1.868-.537.93-2.234-.134-1.372.791-1.001 2.003H7.464l-1.002-2.003-1.37-.792-2.236.135-.537-.93 1.235-1.87V7.21L2.32 5.34l.537-.93 2.236.135Z" clipRule="evenodd" />
    </svg>
  );
}

function IntegrationsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      data-component="Octicon"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
    >
      <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
    </svg>
  );
}

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function WikiIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

const ACCENT_STORAGE_KEY = 'test-project:accent-color';

const projectViews: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'wiki', label: 'Wiki', icon: <WikiIcon /> },
  { id: 'bugs', label: 'Bug Tracker', icon: '!' },
  { id: 'builds', label: 'Builds', icon: '↥' },
  { id: 'github', label: 'GitHub', icon: <GithubIcon /> },
  { id: 'timeline', label: 'Timeline', icon: '↯' },
];

const organizationViews: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: 'organization', label: 'Projects', icon: '⌂' },
  { id: 'organization-team', label: 'Team', icon: '◎' },
  { id: 'organization-integrations', label: 'Integrations', icon: <IntegrationsIcon /> },
  { id: 'workspace', label: 'Organization Settings', icon: <SettingsIcon /> },
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
  const [view, setView] = useState<View>('organization');
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [organizationPickerOpen, setOrganizationPickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const organizationAreaRef = useRef<HTMLDivElement | null>(null);
  const projectAreaRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [incomingInvitations, setIncomingInvitations] = useState<IncomingInvitation[]>([]);

  const [bugs, setBugs] = useState<Bug[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const [newOrganization, setNewOrganization] = useState('');
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [newOrganizationOpen, setNewOrganizationOpen] = useState(false);
  const [organizationProjectCounts, setOrganizationProjectCounts] = useState<Record<string, number>>({});
  const [newBug, setNewBug] = useState('');
  const [selectedWiki, setSelectedWiki] = useState<WikiPage | null>(null);

  const [buildVersion, setBuildVersion] = useState('0.1.0');
  const [buildBranch, setBuildBranch] = useState('main');
  const [buildFile, setBuildFile] = useState<File | null>(null);
  const [buildUploading, setBuildUploading] = useState(false);

  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '#3ecf8e';
    }

    return window.localStorage.getItem(ACCENT_STORAGE_KEY) ?? '#3ecf8e';
  });

  const accentStyle: CSSProperties = { '--accent': accentColor } as CSSProperties;

  function changeAccentColor(nextColor: string) {
    if (!/^#[0-9a-fA-F]{6}$/.test(nextColor)) {
      return;
    }

    setAccentColor(nextColor);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, nextColor);
  }

  const activeView = useMemo(() => {
    if (view === 'workspace') {
      return 'Organization Settings';
    }

    return organizationViews.find((item) => item.id === view)?.label
      ?? projectViews.find((item) => item.id === view)?.label
      ?? 'Projects';
  }, [view]);

  useEffect(() => {
    function handleDocumentPointer(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (organizationPickerOpen && !organizationAreaRef.current?.contains(target)) {
        setOrganizationPickerOpen(false);
      }

      if (projectPickerOpen && !projectAreaRef.current?.contains(target)) {
        setProjectPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentPointer);
    return () => document.removeEventListener('mousedown', handleDocumentPointer);
  }, [organizationPickerOpen, projectPickerOpen]);

  useEffect(() => {
    async function initialize() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) return;

        setEmail(user.email ?? '');
        const metadata = user.user_metadata as Record<string, unknown> | null;
        const preferredName = typeof metadata?.user_name === 'string'
          ? metadata.user_name
          : typeof metadata?.preferred_username === 'string'
            ? metadata.preferred_username
            : typeof metadata?.full_name === 'string'
              ? metadata.full_name
              : typeof metadata?.name === 'string'
                ? metadata.name
                : 'there';
        const name = preferredName.startsWith('Everett') ? 'Everett' : preferredName.split('#')[0];
        setDisplayName(name);
        await Promise.all([
          loadOrganizations(user.id),
          loadIncomingInvitations(user.email ?? ''),
        ]);
      } catch (initializeError) {
        setError(initializeError instanceof Error ? initializeError.message : 'Could not load your organization.');
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, []);

  async function loadIncomingInvitations(userEmail: string) {
    if (!userEmail) {
      setIncomingInvitations([]);
      return;
    }

    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('id,organization_id,email,role,expires_at,organizations(name)')
      .eq('status', 'pending')
      .ilike('email', userEmail)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      setIncomingInvitations([]);
      return;
    }

    setIncomingInvitations(
      (data ?? []).map((invitation: any) => ({
        id: invitation.id,
        organization_id: invitation.organization_id,
        organization_name: invitation.organizations?.name ?? 'Organization invitation',
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      })) as IncomingInvitation[],
    );
  }

  async function acceptIncomingInvitation(invitation: IncomingInvitation) {
    try {
      setError('');
      setMessage('');

      const { error } = await supabase.rpc('accept_workspace_invitation', {
        p_invitation_id: invitation.id,
      });

      if (error) {
        throw error;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You are no longer signed in.');
      }

      await loadOrganizations(user.id);
      await loadIncomingInvitations(user.email ?? '');

      const { data: joined, error: joinedError } = await supabase
        .from('organizations')
        .select('id,name,slug,created_by')
        .eq('id', invitation.organization_id)
        .single();

      if (joinedError || !joined) {
        throw joinedError ?? new Error('The organization could not be loaded.');
      }

      await enterOrganization(joined as Organization);
      setMessage(`Joined ${invitation.organization_name}.`);
    } catch (invitationError) {
      setError(
        invitationError instanceof Error
          ? invitationError.message
          : 'Could not accept invitation.',
      );
    }
  }

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

    const projectCounts: Record<string, number> = {};

    if (merged.length > 0) {
      const { data: projectRows, error: projectCountError } = await supabase
        .from('projects')
        .select('organization_id')
        .in('organization_id', merged.map((item) => item.id));

      if (!projectCountError) {
        for (const row of projectRows ?? []) {
          projectCounts[row.organization_id] = (projectCounts[row.organization_id] ?? 0) + 1;
        }
      }
    }

    setOrganizationProjectCounts(projectCounts);
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

      const nextProjects = (data ?? []) as Project[];

      setProjects(nextProjects);
      setProject(null);
      setBugs([]);
      setBuilds([]);
      setWikiPages([]);
      setTimeline([]);
      setSelectedWiki(null);
      setGithubRepo('');
      setGithubBranch('main');
      setNewProjectOpen(false);
      setView('organization');
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
      supabase.from('wiki_pages').select('id,title,slug,content,parent_id,sort_order,updated_at').eq('project_id', nextProject.id).order('sort_order', { ascending: true }),
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
      setProjectPickerOpen(false);
      setError('');
      setWorkspaceLoading(true);
      setProject(nextProject);
      setSelectedWiki(null);
      await loadProjectData(nextProject);
      setView('dashboard');
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

  async function createProjectFromOrganizationHome(name: string, description: string): Promise<boolean> {
    const trimmedName = name.trim();

    if (!organization || !trimmedName) {
      return false;
    }

    try {
      setError('');
      setMessage('');

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('You are no longer signed in.');

      const generatedSlug = slugify(trimmedName);
      const slug = generatedSlug || `project-${crypto.randomUUID().slice(0, 6)}`;      const { data, error: insertError } = await supabase        .from('projects')
        .insert({
          organization_id: organization.id,
          name: trimmedName,
          slug,
          description: description.trim(),
          github_repo: null,
          github_branch: 'main',
        })
        .select('id,name,slug,description,github_repo,github_branch')
        .single();

      if (insertError || !data) {
        throw insertError ?? new Error('Could not create project.');
      }

      const nextProject = data as Project;
      const nextProjects = [...projects, nextProject].sort((a, b) => a.name.localeCompare(b.name));
      setProjects(nextProjects);
      setNewProjectOpen(false);
      await selectProject(nextProject);
      return true;
    } catch (projectError) {
      setError(projectError instanceof Error ? projectError.message : 'Could not create project.');
      return false;
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
        let ancestor: WikiPage | null = target ?? null;
        while (ancestor?.parent_id) {
          if (ancestor.parent_id === pageId) {
            setError('A page cannot be moved inside one of its own children.');
            return false;
          }
          ancestor = wikiPages.find((item) => item.id === ancestor?.parent_id) ?? null;
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
      const { data: { user } } = await supabase.auth.getUser();      if (!user) throw new Error('You are no longer signed in.');

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
    setView('organization');
    setError('');
    setMessage('');
    setOrganizationPickerOpen(true);
    setProjectPickerOpen(false);
    setMenuOpen(false);
  }

  function handleProjectsUpdated(nextProjects: Project[]) {
    setProjects(nextProjects);
  }

  function handleOrganizationUpdated(nextOrganization: Organization) {
    setOrganization(nextOrganization);
    setOrganizations((current) =>
      current.map((item) => item.id === nextOrganization.id ? nextOrganization : item),
    );
  }

  async function handleOrganizationDeleted() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setOrganization(null);
    setProject(null);
    setProjects([]);
    setBugs([]);
    setBuilds([]);
    setWikiPages([]);
    setTimeline([]);
    setSelectedWiki(null);
    setView('dashboard');

    if (user) {
      await loadOrganizations(user.id);
      await loadIncomingInvitations(user.email ?? '');
    }

    setMessage('Organization deleted.');
  }

  if (loading) {
    return <div className="devdock-loading" style={accentStyle}>Loading DevDock...</div>;
  }

  if (workspaceLoading) {
    return <div className="devdock-loading" style={accentStyle}>Loading organization...</div>;
  }

  if (!organization) {
    const normalizedOrganizationSearch = organizationSearch.trim().toLowerCase();
    const filteredOrganizations = organizations.filter((item) =>
      !normalizedOrganizationSearch ||
      [item.name, item.slug].join(' ').toLowerCase().includes(normalizedOrganizationSearch),
    );

    return (
      <div className="organization-picker-shell" style={accentStyle}>
        <header className="organization-picker-topbar">
          <div className="organization-picker-brand">
            <strong className="organization-picker-brand-name">DevDock</strong>
            <span className="organization-picker-slash">/</span>
            <strong>Organizations</strong>
          </div>
          <div className="organization-picker-account">
            <span>{email}</span>
          </div>
        </header>

        <main className="organization-picker-main">
          <div className="organization-picker-heading">
            <h1>Your organizations</h1>
          </div>

          {error && <div className="error-banner organization-picker-error">{error}</div>}

          <div className="organization-picker-toolbar">
            <label className="organization-picker-search">
              <span>⌕</span>
              <input
                value={organizationSearch}
                onChange={(event) => setOrganizationSearch(event.target.value)}
                placeholder="Search for an organization"
              />
            </label>
            <button
              type="button"
              className="primary-button organization-picker-new-button"
              onClick={() => {
                setNewOrganizationOpen((current) => !current);
                setError('');
              }}
            >
              <span>＋</span> New organization
            </button>          </div>
          {newOrganizationOpen && (
            <form              className="organization-picker-create"
              onSubmit={(event) => {
                event.preventDefault();
                if (newOrganization.trim()) void createOrganization();
              }}
            >
              <div>
                <span className="dock-kicker">NEW ORGANIZATION</span>
                <input
                  autoFocus
                  value={newOrganization}
                  onChange={(event) => setNewOrganization(event.target.value)}
                  placeholder="Organization name"
                />
              </div>
              <div className="organization-picker-create-actions">
                <button type="button" className="secondary-button" onClick={() => setNewOrganizationOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={!newOrganization.trim()}>
                  Create organization
                </button>
              </div>
            </form>
          )}

          <div className="organization-picker-list">
            {filteredOrganizations.map((item) => (
              <button
                type="button"
                className="organization-picker-card"
                key={item.id}
                onClick={() => void enterOrganization(item)}
              >
                <span className="organization-picker-card-icon">◇</span>
                <span className="organization-picker-card-info">
                  <strong>{item.name}</strong>
                  <span>{organizationProjectCounts[item.id] ?? 0} projects</span>
                </span>
                <span className="organization-picker-card-arrow">→</span>
              </button>
            ))}

            {filteredOrganizations.length === 0 && (
              <div className="organization-picker-empty">
                <strong>
                  {organizations.length === 0 ? 'No organizations yet.' : 'No organizations match your search.'}
                </strong>
                <span>
                  {organizations.length === 0
                    ? 'Create an organization to get started.'
                    : 'Try a different organization name or slug.'}
                </span>
              </div>
            )}

            {incomingInvitations.length > 0 && (
              <div className="organization-picker-invitations">
                <span className="eyebrow">INVITATIONS</span>
                {incomingInvitations.map((invitation) => (
                  <article className="organization-picker-invitation" key={invitation.id}>
                    <div>
                      <strong>{invitation.organization_name}</strong>
                      <span>{invitation.role} · expires {formatDate(invitation.expires_at)}</span>
                    </div>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void acceptIncomingInvitation(invitation)}
                    >
                      Accept
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="devdock-app" style={accentStyle}>      <header className="devdock-topbar">
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
          <span>{organization.name}</span><span>·</span>
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
            <button
              type="button"
              className="organization-popover-action"
              onClick={() => {
                setView('workspace');
                setOrganizationPickerOpen(false);
              }}
            >
              Organization settings
            </button>
            <button type="button" className="organization-popover-action" onClick={switchOrganization}>
              Choose another organization
            </button>
          </div>
        )}
      </div>

        {project && (
          <div className="project-area" ref={projectAreaRef}>
            <button
              type="button"
              className="organization-switcher project-switcher"
              onClick={() => setProjectPickerOpen((current) => !current)}
              aria-expanded={projectPickerOpen}
              aria-label="Switch project"
            >
              <span className="topbar-project-cube">◇</span>
              <span>{project.name}</span>
              <span>·</span>
            </button>

            {projectPickerOpen && (
              <div className="organization-popover project-popover">
                <div className="popover-heading">Switch project</div>
                {projects.map((item) => (
                  <button
                    type="button"
                    className="organization-popover-option"
                    key={item.id}
                    onClick={() => void selectProject(item)}
                  >
                    <span>{item.name}</span>
                    {item.id === project.id && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {project && <span className="topbar-branch">
          <span className="topbar-branch-icon">⑂</span>
          {project.github_branch}
        </span>}

        {project && <button
          type="button"
          className="topbar-connect"
          onClick={() => setView('github')}
        >
          <span>↗</span>
          Connect
        </button>}
      </header>

      <aside className={`devdock-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-label projects-label">PROJECTS</div>

        {(project ? projectViews : organizationViews).map((item) => (
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
            <span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span>
          </button>
        ))}

        {project && <>
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
        </>}

        <div className="sidebar-spacer" />

        {project && (
          <button
            type="button"
            className={`nav-item${view === 'workspace' ? ' active' : ''}`}
            onClick={() => {
              setView('workspace');
              setMenuOpen(false);
              setError('');
              setMessage('');
            }}
          >
            <span className="nav-icon"><SettingsIcon size={16} /></span>
            <span className="nav-label">Settings</span>
          </button>
        )}

        <div className="account-block">
          <strong>{displayName}</strong><span>{email || 'Signed in'}</span>
        </div>

        <button type="button" className="signout-button" onClick={() => void signOut()}>Sign Out</button>
      </aside>

      {menuOpen && (
        <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      )}

      <main className={project ? 'devdock-main project-mode' : 'devdock-main'}>
        {(project || view !== 'organization') && (
          <div className="workspace-header">
            <div>
              <span className="eyebrow">{organization.name}</span>
              <h1>{view === 'dashboard' ? `Welcome, ${displayName}.` : activeView}</h1>
              <p>{project?.name ?? 'Select a project to begin working inside the organization.'}</p>
            </div>

          </div>
        )}

        {message && <div className="notice-banner">{message}</div>}
        {error && <div className="error-banner">{error}</div>}

        {view === 'organization' && !project && organization && (
          <OrganizationHome
            organization={organization}
            projects={projects}
            onSelectProject={(nextProject) => void selectProject(nextProject)}
            newProjectOpen={newProjectOpen}
            onNewProjectOpen={setNewProjectOpen}
            onCreateProject={createProjectFromOrganizationHome}
          />
        )}

        {view === 'organization-team' && !project && organization && (
          <WorkspaceView
            organization={organization}
            projects={projects}
            currentProjectId={null}
            initialSection="members"
            onSelectProject={selectProject}
            onProjectsUpdated={handleProjectsUpdated}
            onOrganizationUpdated={handleOrganizationUpdated}
            onOrganizationDeleted={() => void handleOrganizationDeleted()}
            accentColor={accentColor}
            onAccentColorChange={changeAccentColor}
          />
        )}

        {view === 'organization-integrations' && !project && (
          <OrganizationUtilityView
            title="Integrations"
            kicker="ORGANIZATION"
            description="Under development."
          >
            <div className="organization-empty-panel">
              <strong>Under development</strong>
              <span>Organization integrations will be available here later.</span>
            </div>
          </OrganizationUtilityView>
        )}

        {view === 'dashboard' && project && (
          <Dashboard project={project} onView={setView} />
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

        {view === 'workspace' && organization && (
          <WorkspaceView
            organization={organization}
            projects={projects}
            currentProjectId={project?.id ?? null}
            onSelectProject={selectProject}
            onProjectsUpdated={handleProjectsUpdated}
            onOrganizationUpdated={handleOrganizationUpdated}
            onOrganizationDeleted={() => void handleOrganizationDeleted()}
            accentColor={accentColor}
            onAccentColorChange={changeAccentColor}
          />
        )}
      </main>
    </div>
  );
}

function Grid3x3Icon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
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
          <button type="button" className={layout === 'grid' ? 'organization-view-button active' : 'organization-view-button'} onClick={() => setLayout('grid')} aria-label="Grid view"><Grid3x3Icon /></button>
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

  return (
    <form
      className="organization-new-project-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) void onCreate(name, description);
      }}
    >
      <div>
        <span className="dock-kicker">NEW PROJECT</span>
        <h3>Create a project</h3>
      </div>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" autoFocus />
      <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description (optional)" />
      <div className="organization-new-project-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary-button" disabled={!name.trim()}>Create project</button>
      </div>
    </form>
  );
}

function OrganizationUtilityView({  title,
  kicker,
  description,  children,
}: {
  title: string;  kicker: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="organization-utility-view">
      <div className="content-card">
        <span className="dock-kicker">{kicker}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </div>
    </section>
  );
}

function Dashboard({
  project,
  onView,
}: {
  project: Project | null;
  onView: (view: View) => void;
}) {
  return (
    <div className="dashboard-grid">
      <section className="dashboard-project-header">
        <div>
          <span className="dock-kicker">ACTIVE PROJECT</span>
          <h2>{project?.name ?? 'No project'}</h2>
          <p>{project?.description}</p>
        </div>
      </section>

      <div className="dashboard-nav-grid">
        <DashboardNavButton title="Wiki" icon={<WikiIcon size={18} />} onClick={() => onView('wiki')} />
        <DashboardNavButton title="Bug Tracker" icon="!" onClick={() => onView('bugs')} />
        <DashboardNavButton title="Builds" icon="↥" onClick={() => onView('builds')} />
        <DashboardNavButton title="GitHub" icon={<GithubIcon size={18} />} onClick={() => onView('github')} />
        <DashboardNavButton title="Timeline" icon="↯" onClick={() => onView('timeline')} />
      </div>
    </div>
  );
}

function DashboardNavButton({
  title, icon, onClick,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="dashboard-nav-button" onClick={onClick}>
      <span className="dashboard-nav-icon">{icon}</span>
      <span className="dashboard-nav-title">{title}</span>
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