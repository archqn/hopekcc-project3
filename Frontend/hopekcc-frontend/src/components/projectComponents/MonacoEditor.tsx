import React, { useEffect } from 'react';
import { useMonaco, Editor } from '@monaco-editor/react';

const MonacoEditor: React.FC = () => {
  const monaco = useMonaco();

  useEffect(() => {
    if (monaco) {
      console.log('Monaco instance:', monaco);
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        noUnusedLocals: true,
        strict: true,
      });
    }
  }, [monaco]);

  return (
    <div>
      <Editor
        height="500px"
        defaultLanguage="html"
        defaultValue="// Type your code here"
        theme="vs-dark"
      />
    </div>
  );
};

export default MonacoEditor;
