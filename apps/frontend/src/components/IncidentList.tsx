import React from 'react';
import { incidents } from '../data/incidents';

export const IncidentList = () => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Incidents</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">ID</th>
            <th className="text-left">Title</th>
            <th className="text-left">Severity</th>
            <th className="text-left">Status</th>
            <th className="text-left">Assignee</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={incident.id}>
              <td>{incident.id}</td>
              <td>{incident.title}</td>
              <td>{incident.severity}</td>
              <td>{incident.status}</td>
              <td>{incident.assignee}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
