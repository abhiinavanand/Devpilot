import React from 'react';

export const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="card">
    {children}
  </div>
);
