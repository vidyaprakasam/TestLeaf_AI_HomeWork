export const jiraConfig = {
  baseUrl: (process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net').replace(/\/+$/,'') ,
  apiToken: process.env.JIRA_API_TOKEN || '',
  email: process.env.JIRA_EMAIL || '',
  project: process.env.JIRA_PROJECT || ''
}

// Debug environment variables
console.log('Jira Configuration:')
console.log(`JIRA_BASE_URL: ${process.env.JIRA_BASE_URL}`)
console.log(`JIRA_EMAIL: ${process.env.JIRA_EMAIL}`)
console.log(`JIRA_PROJECT: ${process.env.JIRA_PROJECT}`)
console.log(`JIRA_API_TOKEN: ${process.env.JIRA_API_TOKEN ? '[SET]' : '[NOT SET]'}`)

// Validate required configuration
if (!jiraConfig.apiToken) {
  console.warn('Warning: JIRA_API_TOKEN is not set')
}

if (!jiraConfig.email) {
  console.warn('Warning: JIRA_EMAIL is not set')
}

// Validate base URL
if (!jiraConfig.baseUrl || jiraConfig.baseUrl === 'https://your-domain.atlassian.net') {
  console.warn('Warning: JIRA_BASE_URL is not set to a valid domain')
}

export const getJiraAuth = () => {
  // Use Basic auth with base64(email:apiToken) as required by Jira Cloud
  const token = Buffer.from(`${jiraConfig.email}:${jiraConfig.apiToken}`).toString('base64')
  return `Basic ${token}`
}