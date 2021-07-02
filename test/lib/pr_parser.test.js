const expect = require('chai').expect;
const prParser = require('../../lib/pr_parser');

describe('pr_parser', () => {
  it('Should reject a totally unrelated URL', () => {
    expect(prParser.parse('https://developer.mozilla.org/fr/')).to.equal(null);
  });

  it('Should parse a PR url', () => {
    expect(prParser.parse('https://github.com/transcovo/invoice/pull/80')).to.deep.equal({
      owner: 'transcovo',
      repo: 'invoice',
      id: '80'
    });
  });

  it('Should accept the commit or files tab of the PR', () => {
    expect(prParser.parse('https://github.com/transcovo/invoice/pull/80/commits')).to.deep.equal({
      owner: 'transcovo',
      repo: 'invoice',
      id: '80'
    });

    expect(prParser.parse('https://github.com/transcovo/invoice/pull/80/files')).to.deep.equal({
      owner: 'transcovo',
      repo: 'invoice',
      id: '80'
    });
  });

  it('Should accept the ignore whitespace flag', () => {
    expect(prParser.parse('https://github.com/transcovo/invoice/pull/80?w=1')).to.deep.equal({
      owner: 'transcovo',
      repo: 'invoice',
      id: '80'
    });

    expect(prParser.parse('https://github.com/transcovo/invoice/pull/80/commits?w=1')).to.deep.equal({
      owner: 'transcovo',
      repo: 'invoice',
      id: '80'
    });
  });
});
