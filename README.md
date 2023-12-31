# Sync GitHub PR Labels with Jira Labels

Sync GitHub PR Labels with Jira Labels is a GitHub Action that automatically synchronizes labels between GitHub pull requests and Jira tickets based on commit messages.

## Usage

To use this GitHub Action in your repository, create a workflow file (e.g., `.github/workflows/sync_labels.yml`) and add the following content:

```yaml
name: Sync Labels

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  sync_labels:
    runs-on: ubuntu-latest
    steps:
    - name: Sync GitHub PR Labels with Jira Labels
      uses: DasBen/github-pr-label-sync-with-jira@<release-version>
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        github-labels: label1, label2, label3
        jira-labels: jira-label1, jira-label2, jira-label3
        jira-api-endpoint: ${{ secrets.JIRA_API_ENDPOINT }}
        jira-auth-token: ${{ secrets.JIRA_AUTH_TOKEN_BASE64 }}
        
  sync_components:
    runs-on: ubuntu-latest
    steps:
      - name: Sync GitHub PR Labels with Jira Components
        uses: DasBen/github-pr-label-sync-with-jira@<release-version>
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-labels: label1, label2,
          jira-components: jira-component1, jira-component2
          jira-api-endpoint: ${{ secrets.JIRA_API_ENDPOINT }}
          jira-auth-token: ${{ secrets.JIRA_AUTH_TOKEN_BASE64 }}
```

## Inputs
| Input               | Description                                                                                                      | Required |
|---------------------|------------------------------------------------------------------------------------------------------------------|----------|
| `github-token`      | The GitHub token for authentication. This should be set to `${{ secrets.GITHUB_TOKEN }}`.                        | Yes      |
| `github-labels`     | Comma-separated list of GitHub labels to add.                                                                    | Yes      |
| `jira-labels`       | Comma-separated list of Jira labels to read.Either jira-label or jira-components must be set.                    | (Yes)    |
| `jira-components`   | Comma-separated list of GitHub components to check. Either jira-label or jira-components must be set.            | (Yes)    |
| `jira-api-endpoint` | The base URL of your Jira API endpoint. Set this as a secret in your repository. The Url must end on rest/api/2/ | Yes      |
| `jira-auth-token`   | Jira authentication token Pair with username:token. Set this as a secret in your repository.                     | Yes      |

## How It Works
This GitHub Action reads the specified GitHub labels and Jira labels from the inputs. It then fetches the commit messages of the current pull request and extracts Jira ticket IDs from them using a regular expression. After extracting the Jira ticket IDs, it queries the Jira API to get the labels associated with those Jira tickets.

For each pair of GitHub and Jira labels, if the Jira label is found in the Jira ticket's labels, it adds the corresponding GitHub label to the pull request.

## License
This GitHub Action is licensed under the MIT License.