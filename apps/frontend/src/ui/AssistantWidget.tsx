import { useState } from 'react';
import type { ChangeEvent } from 'react';

export const AssistantWidget = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendPrompt = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setResponse(data.response || 'No response received.');
    } catch (error) {
      setResponse('Unable to reach the assistant service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assistant">
      <strong>AI Assistant</strong>
      <p className="subtle">Ask for insights, summaries, or next actions.</p>
      <textarea
        placeholder="Summarize deployment risks..."
        value={prompt}
  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)}
      />
      {response ? <p className="subtle">{response}</p> : null}
      <div className="topbar" style={{ marginTop: 12 }}>
        <span className="badge">{loading ? 'Thinking...' : 'Agent Ready'}</span>
        <button className="toggle" onClick={sendPrompt}>
          Send
        </button>
      </div>
    </div>
  );
};
