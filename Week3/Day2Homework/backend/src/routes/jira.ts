import express from 'express';
import { JiraService } from '../services/jiraService';

export const jiraRouter = express.Router();
const jiraService = new JiraService();

jiraRouter.get('/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;
    const story = await jiraService.getStory(storyId);
    const formattedStory = jiraService.formatStoryData(story);
    res.json(formattedStory);
  } catch (error) {
    console.error('Jira fetch error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch Jira story'
    });
  }
});