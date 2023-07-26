// action.js
const core = require('@actions/core');
const { getOctokit, context } = require('@actions/github');
const axios = require('axios');

async function getJiraLabels(jiraTicket) {
    const jiraApiUrl = core.getInput('jira-api-url');
    const jiraAuthTokenBase64 = core.getInput('jira-auth-token');

    const response = await axios.get(
        `${jiraApiUrl}/rest/api/2/issue/${jiraTicket}`,
        {
            headers: {
                Authorization: `Basic ${jiraAuthTokenBase64}`,
            },
        }
    );

    // Check if the response status is 200, otherwise throw an error
    if (response.status !== 200) {
        throw new Error(`Failed to get labels for JIRA ticket ${jiraTicket}`);
    }

    // Continue with the rest of the function
    return response.data.fields.labels || [];
}

async function run() {
    try {
        const githubToken = core.getInput('github-token');
        const githubLabel = core.getInput('github-label');
        const jiraLabel = core.getInput('jira-label');

        const githubLabels = githubLabel.split(',').map(label => label.trim());
        const jiraLabels = jiraLabel.split(',').map(label => label.trim());

        if (githubLabels.length !== jiraLabels.length) {
            throw new Error('GitHub labels and JIRA labels must have the same number of elements.');
        }

        const octokit = getOctokit(githubToken);
        const prNumber = context.payload.pull_request.number;

        // Get the labels of the current pull request
        const prLabels = await octokit.issues.listLabelsOnIssue({
            ...context.repo,
            issue_number: prNumber,
        });

        // Read all commits of the pull request and look for JIRA Tickets in the commit messages
        const commits = await octokit.pulls.listCommits({
            ...context.repo,
            pull_number: prNumber,
        });

        const jiraTickets = new Set();
        const jiraTicketRegex = /[A-Z]+-[0-9]+/g;

        commits.data.forEach(commit => {
            const commitMessage = commit.commit.message;
            const tickets = commitMessage.match(jiraTicketRegex);
            if (tickets) {
                tickets.forEach(ticket => jiraTickets.add(ticket));
            }
        });

        // Fetch Jira labels for each Jira ticket and set GitHub labels accordingly
        for (let i = 0; i < githubLabels.length; i++) {
            const jiraLabel = jiraLabels[i];
            const githubLabel = githubLabels[i];

            if (jiraTickets.has(jiraLabel)) {
                const jiraLabels = await getJiraLabels(jiraLabel);
                if (jiraLabels.includes(jiraLabel)) {
                    // Check if the GitHub label is already present on the pull request
                    const labelExists = prLabels.some(label => label.name === githubLabel);

                    if (!labelExists) {
                        // Set the GitHub label
                        await octokit.issues.addLabels({
                            ...context.repo,
                            issue_number: prNumber,
                            labels: [githubLabel],
                        });
                    }
                }
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
