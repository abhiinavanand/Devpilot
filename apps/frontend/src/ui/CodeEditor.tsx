import { useState } from 'react';

const initialCode = `// Deployment strategy\nconst rollout = async () => {\n  await canary(0.1);\n  await validateSLOs();\n  await promote(1.0);\n};\n`;

export const CodeEditor = () => {
  const [code, setCode] = useState(initialCode);

  return (
    <div className="card">
      <h3>Code Editor</h3>
      <textarea
        className="code-editor"
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
    </div>
  );
};
