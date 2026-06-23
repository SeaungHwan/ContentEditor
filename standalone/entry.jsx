import React from 'react';
import { createRoot } from 'react-dom/client';
import '../app/jodit.css';
import TableEditorLoader from '../app/components/TableEditor/TableEditorLoader';
const container = document.getElementById('table-editor-root');
if (container) {
  createRoot(container).render(React.createElement(TableEditorLoader));
}
