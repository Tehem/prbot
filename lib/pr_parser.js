const prPattern = /^https:\/\/github.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(\/[a-z]+)?(\?.+)?$/u;

module.exports.parse = (prUrl) => {
  const matches = prPattern.exec(prUrl);

  if (matches === null) {
    return null;
  }

  const owner = matches[1];
  const repo = matches[2];
  const id = matches[3];

  return { owner, repo, id };
};
