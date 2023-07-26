# Sync GitHub PR Labels with Jira Labels

Sync GitHub PR Labels with Jira Labels is a GitHub Action that automatically synchronizes labels between GitHub pull requests and Jira tickets based on commit messages.

## Usage

To use this GitHub Action in your repository, create a workflow file (e.g., `.github/workflows/sync_labels.yml`) and add the following content:

```yaml
name: Sync Labels

on:
  pull_request:
    types:
      - opened
      - synchronize

jobs:
  sync_labels:
    runs-on: ubuntu-latest
    steps:
    - name: Sync GitHub PR Labels with Jira Labels
      uses: DasBen/github-pr-label-sync-with-jira@<release-version>
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        github-label: label1, label2, label3
        jira-label: jira-ticket1, jira-ticket2, jira-ticket3
        jira-api-endpoint: ${{ secrets.JIRA_API_ENDPOINT }}
        jira-auth-token: ${{ secrets.JIRA_AUTH_TOKEN_BASE64 }}
```

Make sure to replace your-username/your-repo-name with the actual repository name where your action is located.

## Inputs
| Input               | Description                                                                               | Required |
|---------------------|-------------------------------------------------------------------------------------------|----------|
| `github-token`      | The GitHub token for authentication. This should be set to `${{ secrets.GITHUB_TOKEN }}`. | Yes      |
| `github-label`      | Comma-separated list of GitHub labels to watch.                                           | Yes      |
| `jira-label`        | Comma-separated list of Jira labels to watch.                                             | Yes      |
| `jira-api-endpoint` | The base URL of your JIRA API endpoint. Set this as a secret in your repository.          | Yes      |
| `jira-auth-token`   | Base64-encoded JIRA authentication token. Set this as a secret in your repository.        | Yes      |

## How It Works
This GitHub Action reads the specified GitHub labels and Jira labels from the inputs. It then fetches the commit messages of the current pull request and extracts Jira ticket IDs from them using a regular expression. After extracting the Jira ticket IDs, it queries the Jira API to get the labels associated with those Jira tickets.

For each pair of GitHub and Jira labels, if the Jira label is found in the Jira ticket's labels, it adds the corresponding GitHub label to the pull request.

## License
This GitHub Action is licensed under the MIT License.

Feel free to customize this README according to your specific action. Providing clear instructions and usage examples will help other users make the most of your GitHub Action.