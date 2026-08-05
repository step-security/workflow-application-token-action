import { describe, it, beforeEach, expect } from 'vitest';
import * as github from '@actions/github';
import { GitHubApplication, createApplication, revokeAccessToken } from './github-application.js';
import * as testValues from '../test/test-values.js';

describe('GitHubApplication', () => {

  const TEST_APPLICATION_NAME = 'test';

  describe('creation with invalid private keys', () => {

    it('should fail on an empty private key', async () => {
      await testPrivateKey('', 'privateKey must be provided');
    });

    it('should fail on a private key consisting of whitespace characters', async () => {
      await testPrivateKey(' \n \r\n ', 'privateKey must be provided');
    });

    it('should fail a null private key', async () => {
      await testPrivateKey(null, 'privateKey must be provided');
    });

    it('should fail on an undefined private key', async () => {
      await testPrivateKey(undefined, 'privateKey must be provided');
    });

    async function testPrivateKey(value: string | undefined | null, message: string) {
      try {
        await createApplication({
          // privateKey is validated before applicationId in GitHubApplication's
          // constructor, so the invalid `value` below always throws first,
          // regardless of whether test data for applicationId is present.
          applicationId: testValues.getApplicationId(TEST_APPLICATION_NAME)!,
          // Deliberately passing an invalid value to exercise validation.
          privateKey: value as string
        });
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect((err as Error).message).to.contain(message);
      }
    }
  });

  describe('creation with invalid application id', () => {

    // A syntactically valid dummy key so these tests only exercise applicationId
    // validation, independent of any external test-data file.
    const DUMMY_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nk3y_g03s_her3\n-----END RSA PRIVATE KEY-----\n';

    it('should fail on an empty application id', async () => {
      await testApplicationId('', 'applicationId must be provided');
    });

    it('should fail on a application id consisting of whitespace characters', async () => {
      await testApplicationId(' \n \r\n ', 'applicationId must be provided');
    });

    it('should fail a null application id', async () => {
      await testApplicationId(null, 'applicationId must be provided');
    });

    it('should fail on an undefined application id', async () => {
      await testApplicationId(undefined, 'applicationId must be provided');
    });

    async function testApplicationId(value: string | undefined | null, message: string) {
      try {
        await createApplication({
          // Deliberately passing an invalid value to exercise validation.
          applicationId: value as string,
          privateKey: DUMMY_PRIVATE_KEY
        });
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect((err as Error).message).to.contain(message);
      }
    }
  });

  describe.skip('Installed Application - GHES', () => {

    const TEST_APPLICATION_NAME = 'test-ghes';

    let app: GitHubApplication;

    beforeEach(async () => {
      const key = testValues.getApplicationPrivateKey(TEST_APPLICATION_NAME);
      const id = testValues.getApplicationId(TEST_APPLICATION_NAME);

      if (!key || !id) {
        throw new Error('Application id and key must be provided');
      }

      app = await createApplication({
        applicationId: id,
        privateKey: key,
        baseApiUrl: "https://octodemo.com/api/v3"
      });
    });

    it('should connect to GHES instance', async () => {
      const appData = app.metadata;

      expect(appData).to.have.property('id').to.equal(testValues.getApplicationId(TEST_APPLICATION_NAME));
      expect(appData).to.have.property('owner');
      expect(appData).to.have.property('name');
      expect(appData).to.have.property('permissions');
      expect(appData).to.have.property('installations_count');
    });

    it('should be able to list application installations', async () => {
      const data = await app.getApplicationInstallations();

      expect(data).to.be.an.instanceOf(Array);
      expect(data).to.have.length.greaterThan(0);

      expect(data[0]).to.have.property('id');
    });

    it('should be able to get installation for a repository', async () => {
      const repo = fetchTestRepositoryData(TEST_APPLICATION_NAME);
      const data = await app.getRepositoryInstallation(repo.owner, repo.repo);

      expect(data).to.have.property('id');
      expect(data).to.have.property('permissions');
    });
  });


  describe('Installed Application - GitHub.com', () => {

    const TEST_APPLICATION_NAME = 'test';

    let app: GitHubApplication;

    beforeEach(async () => {
      const key = testValues.getApplicationPrivateKey(TEST_APPLICATION_NAME);
      const id = testValues.getApplicationId(TEST_APPLICATION_NAME);

      if (!key || !id) {
        throw new Error('Application id and key must be provided');
      }

      app = await createApplication({
        applicationId: id,
        privateKey: key,
      });
    });

    it('should connect to GitHub.com', async () => {
      const appData = app.metadata;

      expect(appData).to.have.property('id').to.equal(testValues.getApplicationId(TEST_APPLICATION_NAME));
      expect(appData).to.have.property('owner');
      expect(appData).to.have.property('name');
      expect(appData).to.have.property('permissions');
      expect(appData).to.have.property('installations_count');
    });

    it('should be able to list application installations', async () => {
      const data = await app.getApplicationInstallations();

      expect(data).to.be.an.instanceOf(Array);
      expect(data).to.have.length.greaterThan(0);

      expect(data[0]).to.have.property('id');
    });

    it('should be able to get installation for a repository', async () => {
      const repo = fetchTestRepositoryData(TEST_APPLICATION_NAME);

      const data = await app.getRepositoryInstallation(repo.owner, repo.repo);

      expect(data).to.have.property('id');
      expect(data).to.have.property('permissions');
    });

    it('should be able to get installation for an organization', async () => {
      const data = await app.getOrganizationInstallation(
        testValues.getTestOrganization(TEST_APPLICATION_NAME)
      );

      expect(data).to.have.property('id');
      expect(data).to.have.property('permissions');
    });

    it('should fetch the requested permissions (read)', async () => {
      const data = await app.getOrganizationInstallation(
        testValues.getTestOrganization(TEST_APPLICATION_NAME)
      );

      const accessToken = await app.getInstallationAccessToken(data.id,
        { issues: 'read' }
      );

      expect(accessToken).to.have.property('permissions');
      expect(accessToken.permissions).to.eql({
        issues: 'read',
        metadata: 'read'
      });
    });

    it('should fetch the requested permissions (write)', async () => {
      const data = await app.getOrganizationInstallation(
        testValues.getTestOrganization(TEST_APPLICATION_NAME)
      );

      const accessToken = await app.getInstallationAccessToken(data.id,
        { issues: 'write' }
      );

      expect(accessToken).to.have.property('permissions');
      expect(accessToken.permissions).to.eql({
        issues: 'write',
        metadata: 'read'
      });
    });

    it('should be able to get access token for a repository installation', async () => {
      const testRepo = fetchTestRepositoryData(TEST_APPLICATION_NAME);
      const repoInstall = await app.getRepositoryInstallation(testRepo.owner, testRepo.repo);
      const accessToken = await app.getInstallationAccessToken(repoInstall.id);
      expect(accessToken).to.have.property('token');

      // Use the token to access the repository
      const client = github.getOctokit(accessToken.token);
      const repo = await client.rest.repos.get(testRepo);

      expect(repo).to.have.property('status').to.equal(200);
      expect(repo).to.have.property('data');
      expect(repo.data).to.have.property('owner').to.have.property('login').to.equal(testRepo.owner);
      expect(repo.data).to.have.property('name').to.equal(testRepo.repo);
    }, 10 * 1000);

    describe('Using proxy server', () => {

      describe('Installed Application - GitHub.com', function () {

        const TEST_APPLICATION_NAME = 'test';

        let app;

        beforeEach(async () => {
          const applicationId = testValues.getApplicationId(TEST_APPLICATION_NAME);
          const applicationKey = testValues.getApplicationPrivateKey(TEST_APPLICATION_NAME);

          if (!applicationId || !applicationKey) {
            throw new Error('Application id and key must be provided');
          }

          app = await createApplication({
            applicationId,
            privateKey: applicationKey,
            proxy: `http://${process.env.SQUID_HOST}:3128`
          });
        });

        it('should be able to get access token for a repository installation', async () => {
          const testRepo = fetchTestRepositoryData(TEST_APPLICATION_NAME);

          const repoInstall = await app.getRepositoryInstallation(testRepo.owner, testRepo.repo);
          const accessToken = await app.getInstallationAccessToken(repoInstall.id);
          expect(accessToken).to.have.property('token');

          // Use the token to access the repository
          const client = github.getOctokit(accessToken.token);
          const repo = await client.rest.repos.get(testRepo);

          expect(repo).to.have.property('status').to.equal(200);
          expect(repo).to.have.property('data');
          expect(repo.data).to.have.property('owner').to.have.property('login').to.equal(testRepo.owner);
          expect(repo.data).to.have.property('name').to.equal(testRepo.repo);
          await testRepositoryToken(accessToken.token);
        });
      });
    });

    describe('Application token revocation', () => {

      let testToken;

      beforeEach(async () => {
        const repo = fetchTestRepositoryData(TEST_APPLICATION_NAME);
        const repoInstall = await app.getRepositoryInstallation(repo.owner, repo.repo);

        const accessToken = await app.getInstallationAccessToken(repoInstall.id);
        expect(accessToken).to.have.property('token');
        testToken = accessToken.token;
      });

      it('should be able to revoke a valid application token', async () => {
        await testRepositoryToken(testToken);

        const revoked = await revokeAccessToken(testToken);
        expect(revoked).to.be.true;

        try {
          await testRepositoryToken(testToken);
          expect.fail('The token should no longer be valid so should not get here.');
        } catch (err) {
          expect((err as Error).message).to.contain('Bad credentials');
        }
      });
    });

    async function testRepositoryToken(accessToken) {
      const client = github.getOctokit(accessToken);
      const testRepo = fetchTestRepositoryData(TEST_APPLICATION_NAME);

      const repo = await client.rest.repos.get(testRepo);

      expect(repo).to.have.property('status').to.equal(200);
      expect(repo).to.have.property('data');
      expect(repo.data).to.have.property('owner').to.have.property('login').to.equal(testRepo.owner);
      expect(repo.data).to.have.property('name').to.equal(testRepo.repo);
    }
  });
});


function fetchTestRepositoryData(appName: string) {
  const owner = testValues.getTestRepositoryOwner(appName);
  const repo = testValues.getTestRepository(appName);

  if (!owner || !repo) {
    throw new Error(`No test repository owner and/or name present in test data.`);
  }
  return {
    owner: owner,
    repo: repo
  }
}