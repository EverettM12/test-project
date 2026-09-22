import { useEffect, useMemo, useState } from 'react';
import { supabase } from './utils/supabase.ts';

type Organization = {
  id: string;
  name: string;
  slug: string;
  created_by: string;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  github_repo: string | null;
  github_branch: string;
};

type Member = {
  user_id: string;
  role: 'owner' | 'admin' | 'developer' | 'tester' | 'viewer';
  email: string;
  display_name: string;
  avatar_url: string | null;
};

type Invitation = {
  id: string;
  email: string;
  role: 'admin' | 'developer' | 'tester' | 'viewer';
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  expires_at: string;
};

type Section = 'overview' | 'projects' | 'members' | 'danger';

type WorkspaceViewProps = {
  organization: Organization;
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (project: Project) => void;
  onProjectsUpdated: (projects: Project[]) => void;
  onOrganizationUpdated: (organization: Organization) => void;
  onOrganizationDeleted: () => void;
  initialSection?: Section;
  accentColor?: string;
  onAccentColorChange?: (color: string) => void;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function WorkspaceView({
  organization,
  projects,
  currentProjectId,
  onSelectProject,
  onProjectsUpdated,
  onOrganizationUpdated,
  onOrganizationDeleted,
  initialSection = 'overview',
  accentColor = '#3ecf8e',
  onAccentColorChange,
}: WorkspaceViewProps) {
  const [section, setSection] = useState<Section>(initialSection);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);
  const [role, setRole] = useState<Member['role']>('viewer');
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [organizationName, setOrganizationName] = useState(organization.name);
  const [organizationSlug, setOrganizationSlug] = useState(organization.slug);

  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectGithubRepo, setProjectGithubRepo] = useState('');
  const [projectGithubBranch, setProjectGithubBranch] = useState('main');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Invitation['role']>('developer');

  const canManageOrganization = role === 'owner' || role === 'admin';
  const canManageProjects = role === 'owner' || role === 'admin' || role === 'developer';
  const isOwner = role === 'owner';

  const projectCountText = useMemo(
    () => `${projects.length} project${projects.length === 1 ? '' : 's'}`,
    [projects.length],
  );

  useEffect(() => {
    setOrganizationName(organization.name);
    setOrganizationSlug(organization.slug);
  }, [organization.id, organization.name, organization.slug]);

  useEffect(() => {
    async function loadWorkspace() {
      setLoading(true);
      setError('');

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error('You are no longer signed in.');
        }

        if (organization.created_by === user.id) {
          setRole('owner');
        } else {
          const { data: membership, error: membershipError } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', organization.id)
            .eq('user_id', user.id)
            .single();

          if (membershipError) {
            throw membershipError;
          }

          setRole((membership?.role ?? 'viewer') as Member['role']);
        }

        const { data: memberRows, error: membersError } = await supabase
          .from('organization_members')
          .select('user_id,role')
          .eq('organization_id', organization.id)
          .order('created_at');

        if (membersError) {
          throw membersError;
        }

        const memberUserIds = (memberRows ?? []).map(
          (member: { user_id: string; role: Member['role'] }) => member.user_id,
        );

        let profileMap = new Map<string, { email: string; display_name: string; avatar_url: string | null }>();

        if (memberUserIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id,email,display_name,avatar_url')
            .in('id', memberUserIds);

          if (profilesError) {
            throw profilesError;
          }

          profileMap = new Map(
            (profiles ?? []).map(
              (profile: {
                id: string;
                email: string;
                display_name: string;
                avatar_url: string | null;
              }) => [
                profile.id,
                {
                  email: profile.email,
                  display_name: profile.display_name,
                  avatar_url: profile.avatar_url,
                },
              ],
            ),
          );
        }

        setMembers(
          (memberRows ?? []).map(
            (member: { user_id: string; role: Member['role'] }) => {
              const profile = profileMap.get(member.user_id);
              return {
                user_id: member.user_id,
                role: member.role,
                email: profile?.email ?? 'Unknown account',
                display_name: profile?.display_name || profile?.email || 'Unknown user',
                avatar_url: profile?.avatar_url ?? null,
              };
            },
          ),
        );

        const { data: inviteRows, error: invitationsError } = await supabase
          .from('workspace_invitations')
          .select('id,email,role,status,created_at,expires_at')
          .eq('organization_id', organization.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (invitationsError) {
          throw invitationsError;
        }

        setInvitations((inviteRows ?? []) as Invitation[]);
      } catch (workspaceError) {
        setError(
          workspaceError instanceof Error
            ? workspaceError.message
            : 'Could not load organization settings.',
        );
      } finally {
        setLoading(false);
      }
    }

    void loadWorkspace();
  }, [organization.id, organization.created_by]);

  function resetProjectForm() {
    setProjectFormOpen(false);
    setEditingProjectId(null);
    setProjectName('');
    setProjectSlug('');
    setProjectDescription('');
    setProjectGithubRepo('');
    setProjectGithubBranch('main');
  }

  function beginCreateProject() {
    resetProjectForm();
    setProjectFormOpen(true);
  }

  function beginEditProject(project: Project) {
    setEditingProjectId(project.id);
    setProjectFormOpen(true);
    setProjectName(project.name);
    setProjectSlug(project.slug);
    setProjectDescription(project.description);
    setProjectGithubRepo(project.github_repo ?? '');
    setProjectGithubBranch(project.github_branch || 'main');
    setSection('projects');
  }

  async function saveOrganization() {
    if (!canManageOrganization) {
      return;
    }

    const name = organizationName.trim();

    if (!name) {
      setError('Organization name cannot be empty.');
      return;
    }

    setWorking(true);
    setError('');
    setNotice('');

    const { data, error: updateError } = await supabase
      .from('organizations')
      .update({
        name,
        slug: organizationSlug.trim() || organization.slug,
      })
      .eq('id', organization.id)
      .select('id,name,slug,created_by')
      .single();

    if (updateError || !data) {
      setError(updateError?.message ?? 'Could not update organization.');
    } else {
      onOrganizationUpdated(data as Organization);
      setNotice('Organization details saved.');
    }

    setWorking(false);
  }

  async function saveProject() {
    if (!canManageProjects) {
      return;
    }

    const name = projectName.trim();

    if (!name) {
      setError('Project name cannot be empty.');
      return;
    }

    const generatedSlug = slugify(projectSlug.trim() || name);
    const slug = generatedSlug || `project-${crypto.randomUUID().slice(0, 6)}`;

    setWorking(true);
    setError('');
    setNotice('');

    try {
      if (!editingProjectId) {
        const { data, error: insertError } = await supabase
          .from('projects')
          .insert({
            organization_id: organization.id,
            name,
            slug,
            description: projectDescription.trim(),
            github_repo: projectGithubRepo.trim() || null,
            github_branch: projectGithubBranch.trim() || 'main',
          })
          .select('id,name,slug,description,github_repo,github_branch')
          .single();

        if (insertError || !data) {
          throw insertError ?? new Error('Could not create project.');
        }

        const nextProjects = [...projects, data as Project].sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        onProjectsUpdated(nextProjects);
        onSelectProject(data as Project);
        setNotice('Project created.');
      } else {
        const { data, error: updateError } = await supabase
          .from('projects')
          .update({
            name,
            slug,
            description: projectDescription.trim(),
            github_repo: projectGithubRepo.trim() || null,
            github_branch: projectGithubBranch.trim() || 'main',
          })
          .eq('id', editingProjectId)
          .select('id,name,slug,description,github_repo,github_branch')
          .single();

        if (updateError || !data) {
          throw updateError ?? new Error('Could not update project.');
        }

        const nextProjects = projects
          .map((item) => (item.id === editingProjectId ? (data as Project) : item))
          .sort((a, b) => a.name.localeCompare(b.name));

        onProjectsUpdated(nextProjects);

        if (currentProjectId === editingProjectId) {
          onSelectProject(data as Project);
        }

        setNotice('Project updated.');
      }

      resetProjectForm();
    } catch (projectError) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : 'Could not save project.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function deleteProject(target: Project) {
    if (!canManageOrganization) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${target.name}" and all of its stored data? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setError('');
    setNotice('');

    try {
      const { data: buildRows, error: buildError } = await supabase
        .from('builds')
        .select('storage_path')
        .eq('project_id', target.id);

      if (buildError) {
        throw buildError;
      }

      const paths = (buildRows ?? [])
        .map((build: { storage_path: string | null }) => build.storage_path)
        .filter((path): path is string => Boolean(path));

      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from('builds').remove(paths);
        if (storageError) {
          throw storageError;
        }
      }

      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', target.id);

      if (deleteError) {
        throw deleteError;
      }

      const nextProjects = projects.filter((item) => item.id !== target.id);
      onProjectsUpdated(nextProjects);

      if (currentProjectId === target.id) {
        if (nextProjects.length > 0) {
          onSelectProject(nextProjects[0]);
        }
      }

      setNotice('Project deleted.');
    } catch (projectError) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : 'Could not delete project.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function updateMemberRole(member: Member, nextRole: Member['role']) {
    if (!canManageOrganization || member.role === 'owner') {
      return;
    }

    setWorking(true);
    setError('');
    setNotice('');

    const { error: updateError } = await supabase
      .from('organization_members')
      .update({ role: nextRole })
      .eq('organization_id', organization.id)
      .eq('user_id', member.user_id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMembers((current) =>
        current.map((item) =>
          item.user_id === member.user_id ? { ...item, role: nextRole } : item,
        ),
      );
      setNotice(`${member.display_name}'s role is now ${nextRole}.`);
    }

    setWorking(false);
  }

  async function removeMember(member: Member) {
    if (!canManageOrganization || member.role === 'owner') {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.display_name} from ${organization.name}?`,
    );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setError('');
    setNotice('');

    const { error: removeError } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', organization.id)
      .eq('user_id', member.user_id);

    if (removeError) {
      setError(removeError.message);
    } else {
      setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
      setNotice(`${member.display_name} was removed.`);
    }

    setWorking(false);
  }

  async function inviteMember() {
    if (!canManageOrganization) {
      return;
    }

    const email = inviteEmail.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    try {
      setWorking(true);
      setError('');
      setNotice('');

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You are no longer signed in.');
      }

      const { data, error: insertError } = await supabase
        .from('workspace_invitations')
        .insert({
          organization_id: organization.id,
          email,
          role: inviteRole,
          invited_by: user.id,
        })
        .select('id,email,role,status,created_at,expires_at')
        .single();

      if (insertError || !data) {
        throw insertError ?? new Error('Could not create invitation.');
      }

      setInvitations((current) => [data as Invitation, ...current]);
      setInviteEmail('');
      setNotice(
        'Invitation created. The recipient can accept it when they sign in with this email address.',
      );
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : 'Could not create invitation.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function cancelInvitation(invitation: Invitation) {
    if (!canManageOrganization) {
      return;
    }

    const { error: cancelError } = await supabase
      .from('workspace_invitations')
      .delete()
      .eq('id', invitation.id);

    if (cancelError) {
      setError(cancelError.message);
      return;
    }

    setInvitations((current) => current.filter((item) => item.id !== invitation.id));
    setNotice('Invitation cancelled.');
  }

  async function deleteOrganization() {
    if (!isOwner) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${organization.name}" and all projects, Wiki pages, bugs, builds, and timeline data inside it? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setError('');
    setNotice('');

    try {
      const { data: projectRows, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', organization.id);

      if (projectError) {
        throw projectError;
      }

      const projectIds = (projectRows ?? []).map((project: { id: string }) => project.id);

      if (projectIds.length > 0) {
        const { data: buildRows, error: buildError } = await supabase
          .from('builds')
          .select('storage_path')
          .in('project_id', projectIds);

        if (buildError) {
          throw buildError;
        }

        const paths = (buildRows ?? [])
          .map((build: { storage_path: string | null }) => build.storage_path)
          .filter((path): path is string => Boolean(path));

        if (paths.length > 0) {
          const { error: storageError } = await supabase.storage.from('builds').remove(paths);
          if (storageError) {
            throw storageError;
          }
        }
      }

      const { error: deleteError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organization.id);

      if (deleteError) {
        throw deleteError;
      }

      onOrganizationDeleted();
    } catch (organizationError) {
      const errorMessage =
        organizationError instanceof Error
          ? organizationError.message
          : typeof organizationError === 'object' &&
              organizationError !== null &&
              'message' in organizationError
            ? String((organizationError as { message: unknown }).message)
            : 'Could not delete organization.';
      setError(errorMessage);
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <div className="workspace-management-loading">Loading organization settings...</div>;
  }

  return (
    <section className="workspace-management">
      <div className="workspace-management-nav">
        <button
          type="button"
          className={section === 'overview' ? 'active' : ''}
          onClick={() => setSection('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={section === 'projects' ? 'active' : ''}
          onClick={() => setSection('projects')}
        >
          Projects
        </button>
        <button
          type="button"
          className={section === 'members' ? 'active' : ''}
          onClick={() => setSection('members')}
        >
          Members
        </button>
        {isOwner && (
          <button
            type="button"
            className={section === 'danger' ? 'active danger-tab' : 'danger-tab'}
            onClick={() => setSection('danger')}
          >
            Danger zone
          </button>
        )}
      </div>

      {notice && <div className="workspace-notice">{notice}</div>}
      {error && <div className="workspace-error">{error}</div>}

      {section === 'overview' && (
        <div className="workspace-management-grid">
          <section className="workspace-card workspace-card-wide">
            <div className="workspace-card-heading">
              <div>
                <span className="dock-kicker">ORGANIZATION</span>
                <h2>{organization.name}</h2>
                <p>Your organization's identity and ownership.</p>
              </div>
              <span className="workspace-role-badge">{role}</span>
            </div>

            <div className="workspace-form-grid">
              <label>
                Organization name
                <input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  disabled={!canManageOrganization}
                />
              </label>
              <label>
                Organization slug
                <input
                  value={organizationSlug}
                  onChange={(event) => setOrganizationSlug(event.target.value)}
                  disabled={!canManageOrganization}
                />
              </label>
            </div>

            {canManageOrganization && (
              <button type="button" className="primary-button" disabled={working} onClick={() => void saveOrganization()}>
                {working ? 'Saving...' : 'Save organization'}
              </button>
            )}
          </section>

          <section className="workspace-card">
            <div className="workspace-card-heading">
              <div>
                <span className="dock-kicker">APPEARANCE</span>
                <h2>Accent color</h2>
                <p>Choose the accent used throughout the site. Your choice is saved for the next load.</p>
              </div>
            </div>

            <div className="workspace-accent-picker">
              <label className="workspace-accent-swatch">
                <span>Color</span>
                <input
                  type="color"
                  value={accentColor}
                  disabled={!canManageOrganization || !onAccentColorChange}
                  onChange={(event) => onAccentColorChange?.(event.target.value)}
                />
              </label>
              <label>
                Hex
                <input
                  value={accentColor}
                  disabled={!canManageOrganization || !onAccentColorChange}
                  onChange={(event) => onAccentColorChange?.(event.target.value)}
                  placeholder="#3ecf8e"
                  maxLength={7}
                />
              </label>
            </div>
          </section>

          <section className="workspace-card">
            <span className="dock-kicker">PROJECTS</span>
            <strong className="workspace-big-number">{projects.length}</strong>
            <span className="workspace-card-muted">{projectCountText}</span>
            <button type="button" className="workspace-card-link" onClick={() => setSection('projects')}>
              Manage projects →
            </button>
          </section>

          <section className="workspace-card">
            <span className="dock-kicker">MEMBERS</span>
            <strong className="workspace-big-number">{members.length}</strong>
            <span className="workspace-card-muted">people in organization</span>
            <button type="button" className="workspace-card-link" onClick={() => setSection('members')}>
              Manage members →
            </button>
          </section>
        </div>
      )}

      {section === 'projects' && (
        <section className="workspace-card workspace-projects-card">
          <div className="workspace-card-heading">
            <div>
              <span className="dock-kicker">PROJECT MANAGEMENT</span>
              <h2>Projects</h2>
              <p>Create separate products inside this organization and control their repository metadata.</p>
            </div>
            {canManageProjects && (
              <button type="button" className="primary-button" onClick={beginCreateProject}>
                + New project
              </button>
            )}
          </div>

          {projectFormOpen && (
            <div className="workspace-project-form">
              <div className="workspace-form-grid">
                <label>
                  Project name
                  <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
                </label>
                <label>
                  Project slug
                  <input value={projectSlug} onChange={(event) => setProjectSlug(event.target.value)} />
                </label>
                <label className="workspace-form-full">
                  Description
                  <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} />
                </label>
                <label>
                  GitHub repository
                  <input value={projectGithubRepo} onChange={(event) => setProjectGithubRepo(event.target.value)} placeholder="owner/repository" />
                </label>
                <label>
                  Default branch
                  <input value={projectGithubBranch} onChange={(event) => setProjectGithubBranch(event.target.value)} />
                </label>
              </div>

              <div className="workspace-form-actions">
                <button type="button" className="secondary-button" onClick={resetProjectForm}>Cancel</button>
                <button type="button" className="primary-button" disabled={working} onClick={() => void saveProject()}>
                  {working ? 'Saving...' : editingProjectId ? 'Save project' : 'Create project'}
                </button>
              </div>
            </div>
          )}

          <div className="workspace-project-list">
            {projects.map((item) => (
              <article className="workspace-project-row" key={item.id}>
                <button type="button" className="workspace-project-main" onClick={() => onSelectProject(item)}>
                  <span className={item.id === currentProjectId ? 'workspace-project-indicator active' : 'workspace-project-indicator'} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.slug}{item.description ? ` · ${item.description}` : ''}</small>
                  </span>
                </button>

                <div className="workspace-project-actions">
                  <button type="button" className="secondary-button" onClick={() => beginEditProject(item)} disabled={!canManageProjects}>
                    Edit
                  </button>
                  <button type="button" className="danger-button" onClick={() => void deleteProject(item)} disabled={!canManageOrganization}>
                    Delete
                  </button>
                </div>
              </article>
            ))}

            {projects.length === 0 && (
              <div className="workspace-empty">
                <strong>No projects yet.</strong>
                <span>Create a project to start working inside this organization.</span>
              </div>
            )}
          </div>
        </section>
      )}

      {section === 'members' && (
        <div className="workspace-management-grid">
          <section className="workspace-card workspace-card-wide">
            <div className="workspace-card-heading">
              <div>
                <span className="dock-kicker">PEOPLE</span>
                <h2>Members</h2>
                <p>Control who can work in this organization and what they can manage.</p>
              </div>
            </div>

            <div className="workspace-member-list">
              {members.map((member) => (
                <article className="workspace-member-row" key={member.user_id}>
                  <div className="workspace-member-avatar">
                    {member.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="workspace-member-identity">
                    <strong>{member.display_name}</strong>
                    <span>{member.email}</span>
                  </div>
                  <select
                    value={member.role}
                    disabled={!canManageOrganization || member.role === 'owner' || working}
                    onChange={(event) => void updateMemberRole(member, event.target.value as Member['role'])}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="developer">Developer</option>
                    <option value="tester">Tester</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {member.role !== 'owner' && canManageOrganization && (
                    <button type="button" className="danger-button" onClick={() => void removeMember(member)}>
                      Remove
                    </button>
                  )}
                </article>
              ))}

              {members.length === 0 && (
                <div className="workspace-empty">
                  <strong>No members found.</strong>
                </div>
              )}
            </div>
          </section>

          <section className="workspace-card">
            <span className="dock-kicker">INVITE</span>
            <h3>Invite someone</h3>
            <p>Add a person to this organization by email. The invitation can be accepted when they sign in.</p>

            {canManageOrganization && (
              <>
                <label>
                  Email
                  <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="person@example.com" />
                </label>

                <label>
                  Role
                  <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Invitation['role'])}>
                    <option value="developer">Developer</option>
                    <option value="tester">Tester</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                <button type="button" className="primary-button" disabled={working} onClick={() => void inviteMember()}>
                  Create invitation
                </button>
              </>
            )}
          </section>

          <section className="workspace-card workspace-card-wide">
            <div className="workspace-card-heading">
              <div>
                <span className="dock-kicker">PENDING</span>
                <h2>Invitations</h2>
                <p>Invitations expire automatically after seven days.</p>
              </div>
            </div>

            <div className="workspace-invitation-list">
              {invitations.map((invitation) => (
                <article className="workspace-invitation-row" key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <span>{invitation.role} · expires {formatDate(invitation.expires_at)}</span>
                  </div>
                  {canManageOrganization && (
                    <button type="button" className="secondary-button" onClick={() => void cancelInvitation(invitation)}>
                      Cancel
                    </button>
                  )}
                </article>
              ))}

              {invitations.length === 0 && (
                <div className="workspace-empty">
                  <strong>No pending invitations.</strong>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {section === 'danger' && isOwner && (
        <section className="workspace-card workspace-danger-card">
          <span className="dock-kicker">DANGER ZONE</span>
          <h2>Delete this organization</h2>
          <p>
            This removes the organization and all of its projects, documentation, issues, builds,
            connections, timeline events, and memberships.
          </p>
          <button type="button" className="danger-button danger-button-large" disabled={working} onClick={() => void deleteOrganization()}>
            {working ? 'Deleting...' : 'Delete organization permanently'}
          </button>
        </section>
      )}
    </section>
  );
}

export default WorkspaceView;
