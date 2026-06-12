import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { workspaceApi, type IncidentAnalysis } from '../api/workspace';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AIChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null);
  const [input, setInput] = useState('Summarize current incident risk');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    workspaceApi.incidentAnalysis().then(setAnalysis).catch(() => setAnalysis(null));
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage: Message = { role: 'user', content: input };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiClient.post<{ response: string }>('/ai/chat', { prompt: userMessage.content });
      setMessages((current) => [...current, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'Unable to reach the AI incident analysis service.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="topbar">
        <div>
          <h2>AI Incident Analysis</h2>
          <p className="subtle">{analysis?.summary || 'Backend analysis combines incidents, SLOs, deployments, and Kubernetes signals.'}</p>
        </div>
        <span className="badge">{analysis ? `${analysis.riskScore}/100 risk` : 'Loading'}</span>
      </div>

      {analysis ? (
        <div className="grid">
          {analysis.signals.map((signal) => (
            <div className="card" key={signal.label}>
              <p className="subtle">{signal.label}</p>
              <p className="metric">{signal.value}</p>
              <span className="badge">{signal.severity}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="timeline">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className="card">
            <strong>{message.role === 'user' ? 'You' : 'Assistant'}</strong>
            <p className="subtle" style={{ whiteSpace: 'pre-line' }}>{message.content}</p>
          </div>
        ))}
      </div>

      <div className="topbar">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleSend()}
          className="editor"
          style={{ minHeight: 'auto' }}
        />
        <button onClick={handleSend} className="toggle" disabled={loading}>
          {loading ? 'Analyzing' : 'Send'}
        </button>
      </div>
    </div>
  );
};
