class OpenAIAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async sendMessage(prompt, modelName) {
        try {
            console.log('Sending request to OpenAI API...');
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_completion_tokens: 4096
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('API Response:', response.status, errorData);
                throw new Error(`API call failed: ${response.status} - ${errorData}`);
            }

            const data = await response.json();
            console.log('OpenAI API response:', data);

            return {
                content: data.choices[0].message.content,
                usage: {
                    input_tokens: data.usage.prompt_tokens,
                    output_tokens: data.usage.completion_tokens
                }
            };
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            throw error;
        }
    }
}

// Make the class available globally
window.OpenAIAPI = OpenAIAPI; 