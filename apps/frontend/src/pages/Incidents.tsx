import React, { useState } from 'react';
import { IncidentList } from '../components/IncidentList';
import { IncidentDetails } from '../components/IncidentDetails';

export const Incidents = () => {
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Incident Management</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <IncidentList />
        </div>
        <div className="md:col-span-2">
          {selectedIncident ? (
            <IncidentDetails incidentId={selectedIncident} />
          ) : (
            <div className="p-4 bg-white rounded-lg shadow">
              <p>Select an incident to see details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
