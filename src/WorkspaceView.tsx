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

          <section className="workspace-card workspace-card-wide">
            <div className="workspace-card-heading">
              <div>
                <span className="dock-kicker">APPEARANCE</span>
                <h2>Accent color</h2>
                <p>Choose the accent used throughout the site.</p>
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
                  value={accentInput}
                  disabled={!canManageOrganization || !onAccentColorChange}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setAccentInput(nextValue);

                    if (/^#[0-9a-fA-F]{6}$/.test(nextValue)) {
                      onAccentColorChange?.(nextValue);
                    }
                  }}
                  onBlur={() => {
                    if (!/^#[0-9a-fA-F]{6}$/.test(accentInput)) {
                      setAccentInput(accentColor);
                    }
                  }}
                  placeholder="#3ecf8e"
                  maxLength={7}
                />
              </label>
            </div>
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