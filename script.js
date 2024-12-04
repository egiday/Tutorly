const apiKey = "OPEN-AI-KEY"; // Replace with your OpenAI API key

let chatHistory = [
    {
        role: "system",
        content: "You are an AI tutor. Your goal is to help students learn by guiding them step by step without giving direct answers. Engage them with questions, encourage critical thinking, and provide supportive feedback. After responding, suggest related topics or follow-up questions to keep the learning interactive."
    },
]; // Start the conversation with the system's behavior

let progress = {
    interactions: 0,
    topicsCovered: new Set(),
};

document.getElementById('submit-btn').addEventListener('click', handleSendMessage);
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

async function handleSendMessage() {
    const query = document.getElementById('query').value;
    const chatHistoryDiv = document.getElementById('chat-history');
    const typingIndicator = document.getElementById('typing-indicator');

    if (query.trim() === "") {
        alert("Please enter a message.");
        return;
    }

    // Add user message to chat history
    chatHistory.push({ role: "user", content: query });
    addMessageToUI("user", query);

    document.getElementById('query').value = ""; // Clear input field

    typingIndicator.style.display = "block"; // Show typing indicator

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: chatHistory, // Send full conversation history, including system prompt
                max_tokens: 300,
                temperature: 0.7,
            }),
        });

        const data = await response.json();

        if (response.ok) {
            const aiResponse = data.choices[0].message.content;
            chatHistory.push({ role: "assistant", content: aiResponse }); // Add AI response to history
            addMessageToUI("assistant", aiResponse);

            // Generate contextual suggestions from the AI response
            generateSuggestions(aiResponse);

            // Extract topics from the AI response
            await trackTopics(aiResponse);

            // Increment interactions
            progress.interactions++;
            updateProgressTracker();
        } else {
            alert(`Error: ${data.error.message}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        typingIndicator.style.display = "none"; // Hide typing indicator
    }
}

function addMessageToUI(role, content) {
    const chatHistoryDiv = document.getElementById('chat-history');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const avatar = document.createElement('img');
    avatar.src = role === "user" ? "user-avatar.png" : "ai-avatar.png"; // Replace with avatar URLs

    const messageContent = document.createElement('div');
    messageContent.innerHTML = `<p>${content}</p><small>${timestamp}</small>`;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    chatHistoryDiv.appendChild(messageDiv);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight; // Scroll to bottom
}

function toggleTheme() {
    const body = document.body;
    body.classList.toggle("dark");
    const themeToggleBtn = document.getElementById('theme-toggle');
    themeToggleBtn.textContent = body.classList.contains("dark") ? "Light Mode" : "Dark Mode";
}

async function generateSuggestions(response) {
    const suggestionBox = document.getElementById('suggestions');
    suggestionBox.innerHTML = ""; // Clear previous suggestions

    // Create a message array for GPT-4
    const messages = [
        { role: "system", content: "You are an AI assistant helping a student. Based on the following response, generate 3 follow-up questions or related topics to deepen the student's understanding. Make sure the suggestions directly relate to the topic discussed in the response and help the student explore it further." },
        { role: "assistant", content: response }
    ];

    try {
        const suggestionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: messages, // Correctly passing the messages array
                max_tokens: 100,
                temperature: 0.5, // Lower temperature for more focused responses
            }),
        });

        const data = await suggestionResponse.json();

        if (suggestionResponse.ok) {
            // Parse AI-generated suggestions from the response
            const suggestions = data.choices[0].message.content
                .trim()
                .split("\n")
                .filter(Boolean)
                .map((s) => s.replace(/^\d+\.\s*/, "")); // Remove list numbers if present

            // Create suggestion buttons
            suggestions.forEach((suggestion) => {
                const suggestionItem = document.createElement("button");
                suggestionItem.className = "suggestion-item";
                suggestionItem.innerText = suggestion;
                suggestionItem.addEventListener("click", () => handleSendMessage(suggestion));
                suggestionBox.appendChild(suggestionItem);
            });
        } else {
            console.error(`Failed to generate suggestions: ${data.error.message}`);
        }
    } catch (error) {
        console.error(`Error generating suggestions: ${error.message}`);
    }
}


async function trackTopics(response) {
    try {
        const topicExtractionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an AI assistant that extracts key topics from text. Extract the most relevant topics or keywords from the following response in a comma-separated format:",
                    },
                    { role: "assistant", content: response },
                ],
                max_tokens: 10,
                temperature: 0.5,
            }),
        });

        const data = await topicExtractionResponse.json();

        if (topicExtractionResponse.ok) {
            const extractedTopics = data.choices[0].message.content
                .trim()
                .split(",")
                .map((topic) => topic.trim());

            extractedTopics.forEach((topic) => progress.topicsCovered.add(topic));
        } else {
            console.error(`Failed to extract topics: ${data.error.message}`);
        }
    } catch (error) {
        console.error(`Error extracting topics: ${error.message}`);
    }
}

function updateProgressTracker() {
    const tracker = document.getElementById('progress-tracker');
    tracker.innerHTML = `
        Interactions: ${progress.interactions}<br>
        Topics Covered: ${[...progress.topicsCovered].join(", ") || "None"}
    `;
}
