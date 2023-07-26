// action.js
const core = require('@actions/core');
const {getOctokit, context} = require('@actions/github');
const axios = require('axios');

async function getJiraLabels(jiraTicket) {
    const jiraApiUrl = core.getInput('jira-api-url');
    const jiraAuthTokenBase64 = core.getInput('jira-auth-token');

    core.debug(`Fetching JIRA ticket ${jiraTicket} labels from ${jiraApiUrl}`);

    const response = await axios.get(
        `${jiraApiUrl}issue/${jiraTicket}`,
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

        core.debug(`GitHub Labels: ${githubLabel}`);
        core.debug(`JIRA Labels: ${jiraLabel}`);

        const githubLabels = githubLabel.split(',').map(label => label.trim());
        const jiraLabels = jiraLabel.split(',').map(label => label.trim());

        if (githubLabels.length !== jiraLabels.length) {
            throw new Error('GitHub labels and JIRA labels must have the same number of elements.');
        }

        core.debug(`GitHub Labels (Parsed): ${githubLabels}`);
        core.debug(`JIRA Labels (Parsed): ${jiraLabels}`);

        const octokit = getOctokit(githubToken);

        // Get the owner and repo from the context
        const owner = context.repo.owner;
        const repo = context.repo.repo;
        const prNumber = context.payload.pull_request.number;
        core.debug(`Owner: ${owner}, Repo: ${repo}, Pull Request Number ${prNumber}`);

        // Get the labels of the current pull request
        const pullRequest = await octokit.rest.pulls.get({owner, repo, pull_number: prNumber});
        const prLabels = pullRequest.data.labels.map((label) => label.name);

        core.debug(`Current Pull Request Labels: ${prLabels}`);

        // Read all commits of the pull request and look for JIRA Tickets in the commit messages
        const commits = await octokit.rest.pulls.listCommits({
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

        core.debug(`JIRA Tickets found in commits: ${[...jiraTickets]}`);

        // Fetch Jira labels for each Jira ticket and set GitHub labels accordingly
        for (const jiraTicket of jiraTickets) {
            core.debug(`Checking JIRA Ticket: ${jiraTicket}`);

            // Fetch Jira labels for the current Jira ticket
            const jiraTicketLabels = await getJiraLabels(jiraTicket);

            core.debug(`JIRA Ticket Labels: ${jiraTicketLabels}`);

            for (let i = 0; i < jiraLabels.length; i++) {
                const jiraLabel = jiraLabels[i];
                const githubLabel = githubLabels[i];

                if (jiraTicketLabels.includes(jiraLabel)) {
                    core.debug(`JIRA Ticket ${jiraTicket} has label ${jiraLabel}. Matching GitHub Label: ${githubLabel}`);

                    // Check if the GitHub label is already present on the pull request
                    const labelExists = prLabels.includes(githubLabel);

                    if (!labelExists) {
                        core.debug(`Adding GitHub Label: ${githubLabel}`);

                        // Set the GitHub label
                        await octokit.rest.issues.addLabels({
                            ...context.repo,
                            issue_number: prNumber,
                            labels: [githubLabel],
                        });
                    } else {
                        core.debug(`GitHub Label ${githubLabel} already exists on the pull request.`);
                    }
                } else {
                    core.debug(`JIRA Ticket ${jiraTicket} does not have a matching label ${jiraLabel} in JIRA.`);
                }
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
