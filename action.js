// action.js
const core = require('@actions/core');
const {getOctokit, context} = require('@actions/github');
const axios = require('axios');

async function getJiraLabels(jiraTicket) {
    const jiraApiUrl = core.getInput('jira-api-url')
    const jiraAuthToken = core.getInput('jira-auth-token');
    const jiraAuthTokenBase64 = Buffer.from(jiraAuthToken).toString('base64');

    core.debug(`Fetching JIRA Ticket Labels from '${jiraApiUrl}issue/${jiraTicket}'`);

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
        throw new Error(`Failed to get labels for JIRA ticket '${jiraTicket}'`);
    }

    // Continue with the rest of the function
    return response.data.fields.labels || [];
}

async function run() {
    try {
        const githubTokenInput = core.getInput('github-token');
        const githubLabelsInputs = core.getInput('github-labels');
        const jiraComponentsInput = core.getInput('jira-components');
        const jiraLabelsInput = core.getInput('jira-labels');

        // Check if either jira-label or jira-components is provided
        if (!jiraLabelsInput && !jiraComponentsInput) {
            throw new Error('Either jira-labels or jira-components must be provided.');
        }

        core.debug(`GitHub Labels: '${githubLabelsInputs}'`);
        core.debug(`JIRA Labels: '${jiraLabelsInput}'`);
        core.debug(`JIRA Components: '${jiraComponentsInput}'`);

        const githubLabels = githubLabelsInputs.split(',').map(label => label.trim());
        const jiraLabelList = jiraLabelsInput.split(',').map(label => label.trim());
        const jiraComponentsList = jiraComponentsInput !== '' ? jiraComponentsInput.split(',').map(component => component.trim()) : [];

        core.debug(`GitHub Labels (Parsed): '${githubLabels}'`);
        core.debug(`JIRA Labels (Parsed): '${jiraLabelList}'`);
        core.debug(`JIRA Components (Parsed): '${jiraComponentsList}'`);

        if (githubLabelsInputs !== '' || (githubLabels.length !== jiraLabelList.length)) {
            throw new Error('GitHub Labels and JIRA Labels must have the same number of elements.');
        }

        if (githubLabelsInputs !== '' || (githubLabels.length !== jiraComponentsList.length)) {
            throw new Error('GitHub Labels and JIRA Components must have the same number of elements.');
        }

        const octokit = getOctokit(githubTokenInput);

        // Get the owner and repo from the context
        const owner = context.repo.owner;
        const repo = context.repo.repo;
        const prNumber = context.payload.pull_request.number;
        core.debug(`Owner:' ${owner}', Repo: '${repo}', Pull Request Number '${prNumber}'`);

        // Get the labels of the current pull request
        const pullRequest = await octokit.rest.pulls.get({owner, repo, pull_number: prNumber});
        const prLabels = pullRequest.data.labels.map((label) => label.name);

        core.debug(`Current Pull Request Labels: '${prLabels}'`);

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

        // Check each Jira Ticket for Labels or Components and add GitHub Label
        for (const jiraTicket of jiraTickets) {
            core.debug(`Checking JIRA Ticket: ${jiraTicket}`);

            // Fetch Jira labels for the current Jira ticket
            const jiraTicketLabels = await getJiraLabels(jiraTicket);
            core.debug(`JIRA Ticket Labels: ${jiraTicketLabels}`);

            // Check Jira Labels
            core.debug(`Checking JIRA Ticket vs Labels: ${jiraTicket}`);
            for (let i = 0; i < jiraLabelList.length; i++) {
                const jiraLabel = jiraLabelList[i];
                const githubLabel = githubLabels[i];

                // If Label is found from Input List
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

            // Check Jira Components
            core.debug(`Checking JIRA Ticket vs Components: ${jiraTicket}`);
            for (let i = 0; i < jiraLabelList.length; i++) {
                const jiraComponent = jiraLabelList[i];
                const githubLabel = githubLabels[i];
                if (jiraTicketLabels.includes(jiraComponent)) {
                    core.debug(`JIRA Ticket ${jiraTicket} has component ${jiraComponent}.`);

                    // Check if the GitHub component is already present on the pull request
                    const componentExists = prLabels.includes(jiraComponent);

                    if (!componentExists) {
                        core.debug(`Adding GitHub Component: ${githubLabel}`);

                        // Set the GitHub component
                        await octokit.rest.issues.addLabels({
                            ...context.repo,
                            issue_number: prNumber,
                            labels: [githubLabel],
                        });
                    } else {
                        core.debug(`GitHub Label ${githubLabel} already exists on the pull request.`);
                    }
                } else {
                    core.debug(`JIRA Ticket ${jiraTicket} does not have a matching component ${jiraComponent} in JIRA.`);
                }
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
