import express from 'express';
import { createServer as createViteServer } from 'vite';
import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Git API routes
  app.post('/api/git/connect', async (req, res) => {
    const { repoPath } = req.body;
    if (!repoPath) return res.status(400).json({ error: 'repoPath is required' });
    try {
      const git = simpleGit(repoPath);
      const status = await git.status();
      res.json({ status: 'connected', branch: status.current, changes: status.modified.length });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to connect to Git' });
    }
  });

  app.post('/api/git/commit', async (req, res) => {
    const { repoPath, message } = req.body;
    if (!repoPath || !message) return res.status(400).json({ error: 'repoPath and message are required' });
    try {
      const git = simpleGit(repoPath);
      const statusBefore = await git.status();
      if (statusBefore.isClean()) return res.status(400).json({ error: 'No changes to commit' });
      await git.add('.');
      const commitResult = await git.commit(message);
      res.json({ status: 'committed', commit: commitResult.commit });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to commit changes' });
    }
  });

  app.post('/api/git/log', async (req, res) => {
    const { repoPath, limit = 10 } = req.body;
    if (!repoPath) return res.status(400).json({ error: 'repoPath is required' });
    try {
      const git = simpleGit(repoPath);
      const log = await git.log({ maxCount: limit });
      res.json({ status: 'success', log: log.all });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to fetch Git log' });
    }
  });

  // Refactoring API routes
  app.post('/api/refactor/apply', async (req, res) => {
    const { filePath, rule } = req.body;
    if (!filePath || !rule || !rule.pattern || !rule.transformation) {
      return res.status(400).json({ error: 'filePath and valid rule are required' });
    }
    try {
      let content = await fs.readFile(filePath, 'utf-8');
      const regex = new RegExp(rule.pattern, 'g');
      const matches = content.match(regex) || [];
      content = content.replace(regex, rule.transformation);
      await fs.writeFile(filePath, content);
      res.json({ status: 'applied', replacements: matches.length });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to apply refactoring' });
    }
  });

  app.post('/api/refactor/batch', async (req, res) => {
    const { directory, rule } = req.body;
    if (!directory || !rule || !rule.pattern || !rule.transformation) {
      return res.status(400).json({ error: 'directory and valid rule are required' });
    }
    try {
      const files = await fs.readdir(directory);
      let totalReplacements = 0;
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          let content = await fs.readFile(filePath, 'utf-8');
          const regex = new RegExp(rule.pattern, 'g');
          const matches = content.match(regex) || [];
          content = content.replace(regex, rule.transformation);
          if (matches.length > 0) {
            totalReplacements += matches.length;
            await fs.writeFile(filePath, content);
          }
        }
      }
      res.json({ status: 'batch_applied', totalReplacements });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to apply batch refactoring' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
