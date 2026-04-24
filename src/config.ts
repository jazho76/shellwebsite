export const config = {
  // GitHub username for the `projects` command. Empty → the command errors.
  githubUser: '',

  // PostHog project key. Client-visible (inlined in built JS), not a secret.
  // Replace with your own, or leave empty to disable analytics.
  posthogKey: '',

  // Shell hostname override. undefined → derive from window.location.hostname.
  hostname: undefined as string | undefined,

  // Browser tab title. undefined → use the resolved hostname.
  title: 'Shell Website' as string | undefined,
} as const;
