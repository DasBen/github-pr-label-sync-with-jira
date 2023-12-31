// index.js
const core = require('@actions/core');
const {getOctokit, context} = require('@actions/github');
const axios = require('axios');

function constructJiraUrl(jiraApiUrl, jiraTicket) {
    const apiUrl = jiraApiUrl.endsWith('/') ? jiraApiUrl.slice(0, -1) : jiraApiUrl; // Remove trailing slash if exists
    return `${apiUrl}/issue/${jiraTicket}`;
}

async function getJiraLabels(jiraTicket) {
    const jiraApiUrl = core.getInput('jira-api-url', {required: true});
    const constructedUrl = constructJiraUrl(jiraApiUrl, jiraTicket);
    const jiraAuthToken = core.getInput('jira-auth-token', {required: true});
    const jiraAuthTokenBase64 = Buffer.from(jiraAuthToken).toString('base64');

    core.debug(`Fetching Jira Ticket Labels from '${constructedUrl}'`);

    try {
        const response = await axios.get(
            constructedUrl,
            {
                headers: {
                    Authorization: `Basic ${jiraAuthTokenBase64}`,
                },
            }
        );

        // Check if the response status is 200, otherwise throw an error
        if (response.status !== 200) {
            throw new Error(`Failed to get labels for Jira ticket '${jiraTicket}'`);
        }

        return response.data.fields.labels || [];
    } catch (error) {
        if (error.response && error.response.status === 404) {
            throw new Error(`Failed to get labels for Jira ticket '${jiraTicket}'`);
        }
        throw error; // If it's another error, rethrow it
    }
}

async function getJiraComponents(jiraTicket) {
    const jiraApiUrl = core.getInput('jira-api-url', {required: true});
    const constructedUrl = constructJiraUrl(jiraApiUrl, jiraTicket);
    const jiraAuthToken = core.getInput('jira-auth-token', {required: true});
    const jiraAuthTokenBase64 = Buffer.from(jiraAuthToken).toString('base64');

    core.debug(`Fetching Jira Ticket Components from '${constructedUrl}'`);

    try {
        const response = await axios.get(
            constructedUrl, // Use the constructed URL
            {
                headers: {
                    Authorization: `Basic ${jiraAuthTokenBase64}`,
                },
            }
        );

        // Check if the response status is 200, otherwise throw an error
        if (response.status !== 200) {
            throw new Error(`Failed to get components for Jira ticket '${jiraTicket}'`);
        }

        // Continue with the rest of the function
        return response.data.fields.components.map(component => component.name) || [];
    } catch (error) {
        if (error.response) {
            throw new Error(`Failed to get components for Jira ticket '${jiraTicket}'`);
        }
        throw error; // If it's another error, rethrow it
    }
}

async function run() {
    try {
        const githubTokenInput = core.getInput('github-token', {required: true});
        const githubLabelsInputs = core.getInput('github-labels', {required: true});
        const jiraComponentsInput = core.getInput('jira-components');
        const jiraLabelsInput = core.getInput('jira-labels');

        // Check if either jira-label or jira-components is provided
        if (!jiraLabelsInput && !jiraComponentsInput) {
            throw new Error('Either jira-labels or jira-components must be provided.');
        }

        core.debug(`GitHub Labels: '${githubLabelsInputs}'`);
        core.debug(`Jira Labels: '${jiraLabelsInput}'`);
        core.debug(`Jira Components: '${jiraComponentsInput}'`);

        const githubLabelList = githubLabelsInputs.split(',').map(label => label.trim());
        const jiraLabelList = jiraLabelsInput.split(',').map(label => label.trim());
        const jiraComponentsList = jiraComponentsInput.split(',').map(component => {
            core.debug(`Jira Component (Before Trim): '${component}'`);
            let trimmedComponent = component.trim();
            core.debug(`Jira Component (Trimmed): '${trimmedComponent}'`);
            return trimmedComponent;
        });

        core.debug(`GitHub Labels (Parsed): '${githubLabelList}'`);
        core.debug(`Jira Labels (Parsed): '${jiraLabelList}'`);
        core.debug(`Jira Components (Parsed): '${jiraComponentsList}'`);

        if (jiraLabelsInput && githubLabelList.length !== jiraLabelList.length) {
            throw new Error('GitHub Labels and Jira Labels must have the same number of elements.');
        }

        if (jiraComponentsInput && githubLabelList.length !== jiraComponentsList.length) {
            throw new Error('GitHub Labels and Jira Components must have the same number of elements.');
        }

        const octokit = getOctokit(githubTokenInput);

        // Get the owner and repo from the context
        const owner = context.repo.owner;
        const repo = context.repo.repo;
        const prNumber = context.payload.pull_request.number;
        core.debug(`Owner: '${owner}', Repo: '${repo}', Pull Request Number '${prNumber}'`);

        // Get the labels of the current pull request
        const pullRequest = await octokit.rest.pulls.get({owner, repo, pull_number: prNumber});
        const prLabels = pullRequest.data.labels.map((label) => label.name);

        core.debug(`Current Pull Request Labels: '${prLabels}'`);

        // Read all commits of the pull request and look for Jira Tickets in the commit messages
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

        core.debug(`Jira Tickets found in commits: ${[...jiraTickets]}`);

        // Check each Jira Ticket for Labels or Components and add GitHub Label
        for (const jiraTicket of jiraTickets) {
            core.debug(`Checking Jira Ticket: ${jiraTicket}`);

            // Check Jira Labels
            if (jiraLabelsInput) {
                // Fetch Jira labels for the current Jira ticket
                const jiraTicketLabels = await getJiraLabels(jiraTicket);
                core.debug(`Jira Ticket Labels: ${jiraTicketLabels}`);

                // Check Labels
                core.debug(`Checking Jira Ticket vs Labels: ${jiraTicket}`);
                for (let i = 0; i < jiraLabelList.length; i++) {
                    const jiraLabel = jiraLabelList[i];
                    const githubLabel = githubLabelList[i];

                    if (jiraTicketLabels.includes(jiraLabel)) {
                        core.debug(`Jira Ticket '${jiraTicket}' has label '${jiraLabel}'. Matching GitHub Label: '${githubLabel}'`);

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
                            core.debug(`GitHub Label '${githubLabel}' already exists on the pull request.`);
                        }
                    } else {
                        core.debug(`Jira Ticket '${jiraTicket} 'does not have a matching label '${jiraLabel}' in Jira.`);
                    }
                }
            }

            // Check Jira Components
            if (jiraComponentsInput) {
                // Fetch Jira Components for the current Jira ticket
                const jiraTicketComponents = await getJiraComponents(jiraTicket);
                core.debug(`Jira Ticket Components: ${jiraTicketComponents}`);

                // Check Components
                core.debug(`Checking Jira Ticket vs Components: ${jiraTicket}`);
                for (let i = 0; i < jiraComponentsList.length; i++) {
                    const jiraComponent = jiraComponentsList[i];
                    const githubLabel = githubLabelList[i];

                    if (jiraTicketComponents.includes(jiraComponent)) {
                        core.debug(`Jira Ticket '${jiraTicket}' has component '${jiraComponent}'. Matching GitHub Label: '${githubLabel}'`);

                        // Check if the GitHub component is already present on the pull request
                        const labelExists = prLabels.includes(githubLabel);

                        if (!labelExists) {
                            core.debug(`Adding GitHub Component: ${githubLabel}`);

                            // Set the GitHub component
                            await octokit.rest.issues.addLabels({
                                ...context.repo,
                                issue_number: prNumber,
                                labels: [githubLabel],
                            });
                        } else {
                            core.debug(`GitHub Label '${githubLabel}' already exists on the pull request.`);
                        }
                    } else {
                        core.debug(`Jira Ticket '${jiraTicket}' does not have a matching component '${jiraComponent}' in Jira.`);
                    }
                }
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

// This block will only run when this script is executed, but not when imported.
if (require.main === module) {
    (async () => {
        run();
    })();
}

module.exports = {
    getJiraLabels,
    getJiraComponents,
    constructJiraUrl,
    run
};
