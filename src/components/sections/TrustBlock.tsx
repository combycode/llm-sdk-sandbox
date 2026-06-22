import { SANDBOX_REPO_URL } from '../../lib/constants';
import { trackGithubClicked } from '../../lib/analytics';

/**
 * TrustBlock — privacy/transparency note in the left sidebar (under stats).
 * States plainly how the sandbox handles keys, prompts, and analytics, and
 * links to the open-source repo.
 */
export function TrustBlock() {
  return (
    <div className="trust-block">
      <p>
        <strong>Direct browser calls.</strong> Your key and prompts go straight to
        the selected provider. No server. No prompt logging. No key tracking.
      </p>
      <p>
        Analytics collects only anonymous usage events (model selected, request
        success/failure, page visits). Prompts, responses and API keys are never
        collected.
      </p>
      <a
        className="trust-repo"
        href={SANDBOX_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackGithubClicked()}
      >
        Open source on GitHub ↗
      </a>
    </div>
  );
}
