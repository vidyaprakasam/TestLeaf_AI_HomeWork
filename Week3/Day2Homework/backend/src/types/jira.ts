export interface JiraStoryFields {
  summary: string;
  description: string;
  customfield_10016?: string; // Acceptance Criteria field (adjust field ID as needed)
  issuetype: {
    name: string;
  };
  project: {
    key: string;
  };
}

export interface JiraStory {
  id: string;
  key: string;
  fields: JiraStoryFields;
}

export interface JiraApiError {
  errorMessages: string[];
  errors: Record<string, string>;
}

export interface JiraRequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export interface JiraStoryResponse {
  story: JiraStory;
  error?: string;
}