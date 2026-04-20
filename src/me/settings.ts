export const settings = {
  // GitHub username for the `projects` command. Empty → the command errors.
  githubUser: 'jazho76',

  // PostHog project key. Client-visible (inlined in built JS), not a secret.
  // Replace with your own, or leave empty to disable analytics.
  posthogKey: 'phc_oN3M4ovdadwEwSQLPdvnghTZ5UojmX4MoK2zQCmTU55M',

  // Shell hostname override. undefined → derive from window.location.hostname.
  hostname: undefined as string | undefined,
} as const;
