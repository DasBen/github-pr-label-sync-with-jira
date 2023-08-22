// tests/index.test.js
const nock = require('nock');
const core = require('@actions/core');
const {getJiraLabels, getJiraComponents, constructJiraUrl} = require('../index'); // Make sure to export this function in index.js

describe('getJiraLabels', () => {
    afterEach(() => {
        jest.resetAllMocks();
        nock.cleanAll();
    });

    it('should fetch labels correctly', async () => {
        const jiraTicket = 'TEST-123';
        core.getInput = jest
            .fn()
            .mockReturnValueOnce('https://jira.api/')
            .mockReturnValueOnce('auth-token');

        nock('https://jira.api')
            .get(`/issue/${jiraTicket}`)
            .reply(200, {
                fields: {
                    labels: ['label1', 'label2'],
                },
            });

        const labels = await getJiraLabels(jiraTicket);
        expect(labels).toEqual(['label1', 'label2']);
    });

    it('should throw an error if response status is not 200', async () => {
        const jiraTicket = 'TEST-123';
        core.getInput = jest
            .fn()
            .mockReturnValueOnce('https://jira.api/')
            .mockReturnValueOnce('auth-token');

        nock('https://jira.api')
            .get(`/issue/${jiraTicket}`)
            .reply(404);

        await expect(getJiraLabels(jiraTicket)).rejects.toThrow(`Failed to get labels for Jira ticket '${jiraTicket}'`);
    });
});


describe('getJiraComponents', () => {
    afterEach(() => {
        jest.resetAllMocks();
        nock.cleanAll();
    });

    it('should retrieve the components for a given Jira ticket', async () => {
        const jiraTicket = 'TEST-123';
        const expectedComponents = ['Component1', 'Component2'];
        core.getInput = jest
            .fn()
            .mockReturnValueOnce('https://jira.api/')
            .mockReturnValueOnce('auth-token');

        nock('https://jira.api')
            .get(`/issue/${jiraTicket}`)
            .reply(200, {
                fields: {
                    components: expectedComponents.map(name => ({name})),
                },
            });

        const components = await getJiraComponents(jiraTicket);
        expect(components).toEqual(expectedComponents);
    });

    it('should throw an error if response status is not 200 when getting components', async () => {
        const jiraTicket = 'TEST-456';
        core.getInput = jest
            .fn()
            .mockReturnValueOnce('https://jira.api/')
            .mockReturnValueOnce('auth-token');

        nock('https://jira.api')
            .get(`/issue/${jiraTicket}`)
            .reply(404);

        await expect(getJiraComponents(jiraTicket)).rejects.toThrow(`Failed to get components for Jira ticket '${jiraTicket}'`);
    });
});

describe('constructJiraUrl', () => {
    it('should correctly form the Jira URL by removing any trailing slashes and appending the issue ticket', () => {
        expect(constructJiraUrl('https://jira.api/', 'TEST-123')).toEqual('https://jira.api/issue/TEST-123');
        expect(constructJiraUrl('https://jira.api', 'TEST-123')).toEqual('https://jira.api/issue/TEST-123');
    });
});

describe('Authentication', () => {
    it('should construct authorization header correctly with base64-encoded auth token', async () => {
        nock('https://jira.api', {
            reqheaders: {
                authorization: (value) => value === `Basic ${Buffer.from('auth-token').toString('base64')}`,
            },
        })
            .get('/issue/TEST-123')
            .reply(200);

        // Call your function that makes the request here
    });
});

