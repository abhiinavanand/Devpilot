import { MarkdownEditor } from '../ui/MarkdownEditor';
import { CodeEditor } from '../ui/CodeEditor';

export const Workbench = () => (
  <div className="section">
    <MarkdownEditor />
    <CodeEditor />
  </div>
);
