import fetch from 'cross-fetch';
import { jiraConfig, getJiraAuth } from '../config/jira';
import { JiraStory, JiraRequestOptions, JiraApiError } from '../types/jira';

export class JiraService {
  private baseUrl: string;
  private auth: string;

  constructor() {
    this.baseUrl = jiraConfig.baseUrl;
    this.auth = getJiraAuth();
  }

  private async request<T>(endpoint: string, options: JiraRequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${endpoint}`;
    console.log('Making Jira request to:', url);
    const headers = {
      'Authorization': this.auth,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    };
    console.log('Using headers:', { ...headers, Authorization: '[REDACTED]' });

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Jira API error:', errorData);
        const error = errorData as JiraApiError;
        const message = error?.errorMessages?.[0] || Object.values(error?.errors || {})[0] || `HTTP ${response.status}: Failed to fetch from Jira`;
        throw new Error(message);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to communicate with Jira');
    }
  }

  async getStory(storyId: string): Promise<JiraStory> {
    return this.request<JiraStory>(`/issue/${storyId}`);
  }

  // Format the Jira story data to match our application's needs
  formatStoryData(story: JiraStory) {
    return {
      id: story.id,
      key: story.key,
      fields: {
        summary: story.fields.summary,
        description: story.fields.description || '',
        acceptance_criteria: story.fields.customfield_10016 || story.fields.description || ''
      }
    };
  }
}