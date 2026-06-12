import { useState } from 'react';

export const SearchPanel = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);

  const runSearch = async () => {
    if (!query.trim()) return;
    const res = await fetch(`http://localhost:3000/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.results || []);
  };

  return (
    <div className="card">
      <h3>Search</h3>
      <div className="topbar" style={{ marginTop: 12 }}>
        <input
          className="editor"
          style={{ minHeight: 'auto' }}
          placeholder="Search incidents, deployments, projects..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="toggle" onClick={runSearch}>
          Search
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        {results.map((item) => (
          <p key={item} className="subtle">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
};
