import express from 'express';
import { createServer as createViteServer } from 'vite';
import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // Git API routes
  app.post('/api/git/connect', async (req, res) => {
    const { repoPath } = req.body;
    try {
      const git = simpleGit(repoPath);
      const status = await git.status();
      res.json({ status: 'connected', branch: status.current });
    } catch (error) {
      res.status(500).json({ error: 'Failed to connect to Git' });
    }
  });

  app.post('/api/git/commit', async (req, res) => {
    const { repoPath, message } = req.body;
    try {
      const git = simpleGit(repoPath);
      await git.add('.');
      await git.commit(message);
      res.json({ status: 'committed' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to commit changes' });
    }
  });

  // Refactoring API routes
  app.post('/api/refactor/apply', async (req, res) => {
    const { filePath, rule } = req.body;
    try {
      let content = await fs.readFile(filePath, 'utf-8');
      const regex = new RegExp(rule.pattern, 'g');
      content = content.replace(regex, rule.transformation);
      await fs.writeFile(filePath, content);
      res.json({ status: 'applied' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to apply refactoring' });
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
