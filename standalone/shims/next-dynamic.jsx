import React from 'react';

export default function dynamic(importFn, options = {}) {
  const LazyComponent = React.lazy(importFn);
  const Fallback = options.loading || (() => null);
  return function DynamicComponent(props) {
    return (
      <React.Suspense fallback={<Fallback />}>
        <LazyComponent {...props} />
      </React.Suspense>
    );
  };
}
