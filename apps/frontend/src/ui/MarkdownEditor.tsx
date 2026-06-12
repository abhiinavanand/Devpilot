import { useMemo, useState } from 'react';
import { marked } from 'marked';

const initialText = `# Release Notes\n\n## Highlights\n- Improved latency by 18%\n- Rolled out AI assistant v2\n\n## Checklist\n- [x] Canary validation\n- [x] SLO review\n- [ ] Postmortem draft\n`;

export const MarkdownEditor = () => {
  const [value, setValue] = useState(initialText);

  const html = useMemo(() => marked.parse(value), [value]);

  return (
    <div className="card">
      <h3>Markdown Editor</h3>
      <div className="editor-grid">
        <textarea
          className="editor"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="editor-preview" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
};
