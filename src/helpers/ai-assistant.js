const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function getConversationContext(tweetId, db) {
  const getTweetById = db.query("SELECT * FROM posts WHERE id = ?");
  const getUserById = db.query("SELECT username, name FROM users WHERE id = ?");
  
  const context = [];
  let currentTweet = getTweetById.get(tweetId);
  
  while (currentTweet && context.length < 10) {
    const author = getUserById.get(currentTweet.user_id);
    context.unshift({
      author: author.name || author.username,
      content: currentTweet.content,
      created_at: currentTweet.created_at
    });
    
    if (currentTweet.reply_to) {
      currentTweet = getTweetById.get(currentTweet.reply_to);
    } else {
      break;
    }
  }
  
  return context;
}

export async function generateAIResponse(tweetId, mentionContent, db) {
  try {
    const context = await getConversationContext(tweetId, db);
    
    const messages = [
      {
        role: "system",
        content: "You are @h, also known as Happy Robot, a helpful and friendly AI assistant on tweetapus (a twitter-like platform). Keep your responses concise (under 280 characters when possible), natural, and conversational. You can answer questions, provide information, or engage in friendly discussion. Be helpful but brief."
      }
    ];
    
    if (context.length > 0) {
      messages.push({
        role: "system",
        content: `Here's the conversation context:\n${context.map(c => `${c.author}: ${c.content}`).join('\n')}`
      });
    }
    
    messages.push({
      role: "user",
      content: mentionContent
    });
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 300,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API error:", error);
      return null;
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("AI response generation error:", error);
    return null;
  }
}
